import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import monday from "../../lib/monday";
import { getOrderItems, updateOrderStatus } from "../../api/boardQueries";
import { STATUS_LABELS, STATUS_ORDER } from "../../api/boardConstants";

const RELOAD_DEBOUNCE_MS = 250;
const CONTEXT_FALLBACK_MS = 1500;

const REFRESH_EVENTS = new Set([
  "new_items",
  "change_column_values",
  "change_specific_column_value",
  "change_status_column_value",
  "delete_items",
]);

function getFallbackBoardId() {
  if (typeof window === "undefined") return null;
  const fromQuery = new URLSearchParams(window.location.search).get("boardId");
  if (fromQuery) return fromQuery;
  const fromEnv = import.meta.env?.VITE_DEV_BOARD_ID;
  return fromEnv ? String(fromEnv) : null;
}

export default function useKanbanBoard() {
  const [boardId, setBoardId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reloadTimer = useRef(null);

  const loadOrders = useCallback(async (id) => {
    if (!id) return;
    try {
      const items = await getOrderItems(id);
      setOrders(items);
      setError(null);
    } catch (err) {
      setError(err.message || "Could not load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleReload = useCallback(
    (id) => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(
        () => loadOrders(id),
        RELOAD_DEBOUNCE_MS,
      );
    },
    [loadOrders],
  );

  useEffect(() => {
    monday.execute("valueCreatedForUser");

    let gotContext = false;
    const unsubContext = monday.listen("context", (res) => {
      const incomingBoardId = res?.data?.boardId;
      if (incomingBoardId) {
        gotContext = true;
        setBoardId(String(incomingBoardId));
      }
    });

    const unsubEvents = monday.listen("events", (res) => {
      if (REFRESH_EVENTS.has(res?.data?.type) && boardId) {
        scheduleReload(boardId);
      }
    });

    const fallbackTimer = setTimeout(() => {
      if (!gotContext && !boardId) {
        const fallback = getFallbackBoardId();
        if (fallback) {
          setBoardId(fallback);
        } else {
          setLoading(false);
          setError(
            "No board context. Open this view from inside the Production Orders board, or append ?boardId=18410280508 to the URL.",
          );
        }
      }
    }, CONTEXT_FALLBACK_MS);

    return () => {
      clearTimeout(fallbackTimer);
      if (typeof unsubContext === "function") unsubContext();
      if (typeof unsubEvents === "function") unsubEvents();
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [boardId, scheduleReload]);

  useEffect(() => {
    if (!boardId) return;
    setLoading(true);
    loadOrders(boardId);
  }, [boardId, loadOrders]);

  const grouped = useMemo(() => {
    const buckets = Object.fromEntries(STATUS_ORDER.map((s) => [s, []]));
    for (const order of orders) {
      const key = STATUS_ORDER.includes(order.statusLabel)
        ? order.statusLabel
        : STATUS_LABELS.newOrder;
      buckets[key].push(order);
    }
    return buckets;
  }, [orders]);

  const moveCardStatus = useCallback(
    async (itemId, targetStatus) => {
      const current = orders.find((o) => o.id === itemId);
      if (!current || current.statusLabel === targetStatus) return;
      const previousStatus = current.statusLabel;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === itemId ? { ...o, statusLabel: targetStatus } : o,
        ),
      );

      try {
        await updateOrderStatus(boardId, itemId, targetStatus);
        monday.execute("notice", {
          message: `Moved #${itemId} to "${targetStatus}"`,
          type: "success",
          timeout: 2500,
        });
      } catch (err) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === itemId ? { ...o, statusLabel: previousStatus } : o,
          ),
        );
        monday.execute("notice", {
          message: `Could not move order: ${err.message || "unknown error"}`,
          type: "error",
          timeout: 4000,
        });
      }
    },
    [boardId, orders],
  );

  const handleCreated = useCallback(
    async (newItem, meta) => {
      monday.execute("notice", {
        message: meta?.warning || `Order #${newItem?.id || ""} created`,
        type: meta?.warning ? "warning" : "success",
        timeout: meta?.warning ? 5000 : 3500,
      });
      if (boardId) await loadOrders(boardId);
    },
    [boardId, loadOrders],
  );

  return {
    boardId,
    orders,
    loading,
    error,
    grouped,
    moveCardStatus,
    handleCreated,
  };
}
