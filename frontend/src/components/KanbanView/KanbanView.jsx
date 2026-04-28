import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Heading, Loader, AttentionBox, Button, IconButton } from "@vibe/core";
import { Dashboard } from "@vibe/icons";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import monday from "../../lib/monday";
import { getOrderItems, updateOrderStatus } from "../../api/boardQueries";
import { STATUS_LABELS, STATUS_ORDER } from "../../api/boardConstants";
import KanbanColumn from "./KanbanColumn";
import { OrderCardOverlay } from "./OrderCard";
import OrderModal from "../OrderModal/OrderModal";
import OrderDetailsModal from "../OrderDetailsModal/OrderDetailsModal";
import AnalyticsModal from "../AnalyticsModal/AnalyticsModal";
import styles from "./KanbanView.module.scss";

const RELOAD_DEBOUNCE_MS = 250;
const CONTEXT_FALLBACK_MS = 1500;
const COLUMN_ORDER_KEY = "monday-candle:columnOrder";

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

function loadColumnOrder() {
  if (typeof window === "undefined") return STATUS_ORDER;
  try {
    const stored = window.localStorage.getItem(COLUMN_ORDER_KEY);
    if (!stored) return STATUS_ORDER;
    const arr = JSON.parse(stored);
    if (
      Array.isArray(arr) &&
      arr.length === STATUS_ORDER.length &&
      arr.every((s) => STATUS_ORDER.includes(s))
    ) {
      return arr;
    }
  } catch {
    /* fall through */
  }
  return STATUS_ORDER;
}

export default function KanbanView() {
  const [boardId, setBoardId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null); // { type, order } | { type, status }
  const [detailsOrderId, setDetailsOrderId] = useState(null);
  const [columnOrder, setColumnOrder] = useState(loadColumnOrder);
  const reloadTimer = useRef(null);
  const kanbanBodyRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        COLUMN_ORDER_KEY,
        JSON.stringify(columnOrder),
      );
    } catch {
      /* localStorage may be unavailable in iframes */
    }
  }, [columnOrder]);

  // Translate vertical wheel into horizontal kanban scroll when the cursor
  // isn't over a column that can absorb the scroll itself (matches monday's
  // native kanban feel). Native horizontal wheel (shift+wheel, trackpad
  // gestures) is left untouched.
  useEffect(() => {
    const el = kanbanBodyRef.current;
    if (!el) return undefined;

    const cardListSelector = `.${styles.cardList}`;

    function onWheel(e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY === 0) return;

      const cardList = e.target.closest?.(cardListSelector);
      if (cardList) {
        const goingDown = e.deltaY > 0;
        const atBottom =
          cardList.scrollTop + cardList.clientHeight >=
          cardList.scrollHeight - 1;
        const atTop = cardList.scrollTop <= 0;
        if (goingDown ? !atBottom : !atTop) return;
      }

      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Press-and-hold lets horizontal pan gestures pass through cards cleanly
  // (matches monday's native kanban). A pure distance constraint hijacks
  // left/right scrolls.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

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

  const handleOpenCard = useCallback((itemId) => {
    setDetailsOrderId(itemId);
  }, []);

  const detailsOrder = useMemo(
    () => orders.find((o) => o.id === detailsOrderId) || null,
    [orders, detailsOrderId],
  );

  const handleCreated = useCallback(
    async (newItem, meta) => {
      monday.execute("notice", {
        message: meta?.warning || `Order #${newItem?.id || ""} created`,
        type: meta?.warning ? "warning" : "success",
        timeout: meta?.warning ? 5000 : 3500,
      });
      setModalOpen(false);
      if (boardId) await loadOrders(boardId);
    },
    [boardId, loadOrders],
  );

  const handleDragStart = useCallback(
    (event) => {
      const data = event?.active?.data?.current;
      if (data?.type === "column") {
        setActiveItem({ type: "column", status: data.status });
        return;
      }
      const found = orders.find((o) => o.id === event?.active?.id);
      if (found) setActiveItem({ type: "card", order: found });
    },
    [orders],
  );

  const handleDragCancel = useCallback(() => {
    setActiveItem(null);
  }, []);

  const moveCardStatus = useCallback(
    async (itemId, targetStatus) => {
      const current = orders.find((o) => o.id === itemId);
      if (!current || current.statusLabel === targetStatus) return;
      const previousStatus = current.statusLabel;

      // Optimistic update — revert below if the API write fails.
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

  const handleDragEnd = useCallback(
    (event) => {
      setActiveItem(null);
      const { active, over } = event;
      if (!over) return;

      const activeType = active.data?.current?.type;

      if (activeType === "column") {
        if (active.id !== over.id) {
          setColumnOrder((prev) => {
            const oldIdx = prev.indexOf(active.id);
            const newIdx = prev.indexOf(over.id);
            if (oldIdx === -1 || newIdx === -1) return prev;
            return arrayMove(prev, oldIdx, newIdx);
          });
        }
        return;
      }

      // Card drag — `over` is either a column sortable id (the status string)
      // or, defensively, a status carried on the droppable's data payload.
      const itemId = active.id;
      const targetStatus = over.data?.current?.status || over.id;
      if (!itemId || !targetStatus || !boardId) return;
      if (!STATUS_ORDER.includes(targetStatus)) return;
      moveCardStatus(itemId, targetStatus);
    },
    [boardId, moveCardStatus],
  );

  const handleOpenNewOrder = useCallback(() => setModalOpen(true), []);
  const handleCloseNewOrder = useCallback(() => setModalOpen(false), []);
  const handleOpenAnalytics = useCallback(() => setAnalyticsOpen(true), []);
  const handleCloseAnalytics = useCallback(() => setAnalyticsOpen(false), []);
  const handleCloseDetails = useCallback(() => setDetailsOrderId(null), []);

  if (loading && !orders.length) {
    return (
      <div className={styles.kanbanRoot}>
        <div className={styles.loadingWrap}>
          <Loader size="medium" />
        </div>
      </div>
    );
  }

  const activeType = activeItem?.type || null;

  return (
    <div className={styles.kanbanRoot}>
      <header className={styles.headerRow}>
        <div className={styles.headerCopy}>
          <Heading type="h1" weight="bold">
            Production Pipeline
          </Heading>
        </div>
        <div className={styles.headerActions}>
          <IconButton
            icon={Dashboard}
            size="medium"
            kind="secondary"
            ariaLabel="Open analytics"
            tooltipContent="Analytics"
            onClick={handleOpenAnalytics}
            disabled={!boardId}
            className={styles.analyticsButton}
          />
          <Button
            size="medium"
            kind="primary"
            onClick={handleOpenNewOrder}
            disabled={!boardId}
          >
            + New order
          </Button>
        </div>
      </header>

      {error && (
        <div className={styles.errorWrap}>
          <AttentionBox
            type="danger"
            title="Could not load orders"
            text={error}
          />
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={columnOrder}
          strategy={horizontalListSortingStrategy}
        >
          <div ref={kanbanBodyRef} className={styles.kanbanBody}>
            {columnOrder.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                orders={grouped[status] || []}
                onAddClick={
                  status === STATUS_LABELS.newOrder
                    ? handleOpenNewOrder
                    : undefined
                }
                onOpenCard={handleOpenCard}
                activeDragType={activeType}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeItem?.type === "card" ? (
            <OrderCardOverlay order={activeItem.order} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <OrderModal
        show={modalOpen}
        boardId={boardId}
        onClose={handleCloseNewOrder}
        onCreated={handleCreated}
      />

      <OrderDetailsModal
        show={Boolean(detailsOrderId)}
        order={detailsOrder}
        onClose={handleCloseDetails}
      />

      <AnalyticsModal
        show={analyticsOpen}
        boardId={boardId}
        onClose={handleCloseAnalytics}
      />
    </div>
  );
}
