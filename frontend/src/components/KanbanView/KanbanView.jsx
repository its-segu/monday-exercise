import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Heading,
  Text,
  Loader,
  AttentionBox,
  Button,
} from "@vibe/core";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import monday from "../../lib/monday";
import { getOrderItems, updateOrderStatus } from "../../api/boardQueries";
import {
  STATUS_LABELS,
  STATUS_ORDER,
} from "../../api/boardConstants";
import KanbanColumn from "./KanbanColumn";
import { OrderCardOverlay } from "./OrderCard";
import OrderModal from "../OrderModal/OrderModal";
import OrderDetailsModal from "../OrderDetailsModal/OrderDetailsModal";
import AnalyticsModal from "../AnalyticsModal/AnalyticsModal";
import styles from "./KanbanView.module.scss";

function getFallbackBoardId() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("boardId");
  if (fromQuery) return fromQuery;
  const fromEnv = import.meta.env?.VITE_DEV_BOARD_ID;
  if (fromEnv) return String(fromEnv);
  return null;
}

export default function KanbanView() {
  const [boardId, setBoardId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [detailsOrderId, setDetailsOrderId] = useState(null);
  const reloadTimer = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
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
      reloadTimer.current = setTimeout(() => loadOrders(id), 250);
    },
    [loadOrders]
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
      const type = res?.data?.type;
      if (
        type === "new_items" ||
        type === "change_column_values" ||
        type === "change_specific_column_value" ||
        type === "change_status_column_value" ||
        type === "delete_items"
      ) {
        if (boardId) scheduleReload(boardId);
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
            "No board context. Open this view from inside the Production Orders board, or append ?boardId=18410280508 to the URL."
          );
        }
      }
    }, 1500);

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
    [orders, detailsOrderId]
  );

  const handleCreated = useCallback(
    async (newItem, meta) => {
      if (meta?.warning) {
        monday.execute("notice", {
          message: meta.warning,
          type: "warning",
          timeout: 5000,
        });
      } else {
        monday.execute("notice", {
          message: `Order #${newItem?.id || ""} created`,
          type: "success",
          timeout: 3500,
        });
      }
      setModalOpen(false);
      if (boardId) await loadOrders(boardId);
    },
    [boardId, loadOrders]
  );

  const handleDragStart = useCallback(
    (event) => {
      const id = event?.active?.id;
      const found = orders.find((o) => o.id === id);
      if (found) setActiveOrder(found);
    },
    [orders]
  );

  const handleDragCancel = useCallback(() => {
    setActiveOrder(null);
  }, []);

  const handleDragEnd = useCallback(
    async (event) => {
      setActiveOrder(null);

      const itemId = event?.active?.id;
      const targetStatus = event?.over?.data?.current?.status;
      if (!itemId || !targetStatus || !boardId) return;

      const current = orders.find((o) => o.id === itemId);
      if (!current || current.statusLabel === targetStatus) return;

      const previousStatus = current.statusLabel;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === itemId ? { ...o, statusLabel: targetStatus } : o
        )
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
            o.id === itemId ? { ...o, statusLabel: previousStatus } : o
          )
        );
        monday.execute("notice", {
          message: `Could not move order: ${err.message || "unknown error"}`,
          type: "error",
          timeout: 4000,
        });
      }
    },
    [boardId, orders]
  );

  if (loading && !orders.length) {
    return (
      <div className={styles.kanbanRoot}>
        <div className={styles.loadingWrap}>
          <Loader size="medium" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.kanbanRoot}>
      <header className={styles.headerRow}>
        <div className={styles.headerCopy}>
          <Heading type="h1" weight="bold">
            Production Pipeline
          </Heading>
          <Text type="text1" color="secondary">
            Track candle gift box orders from intake through shipping
          </Text>
        </div>
        <div className={styles.headerActions}>
          <Button
            size="medium"
            kind="secondary"
            onClick={() => setAnalyticsOpen(true)}
            disabled={!boardId}
          >
            Analytics
          </Button>
          <Button
            size="medium"
            kind="primary"
            onClick={() => setModalOpen(true)}
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
        <div className={styles.kanbanBody}>
          {STATUS_ORDER.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              orders={grouped[status] || []}
              onAddClick={
                status === STATUS_LABELS.newOrder
                  ? () => setModalOpen(true)
                  : undefined
              }
              onOpenCard={handleOpenCard}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeOrder ? <OrderCardOverlay order={activeOrder} /> : null}
        </DragOverlay>
      </DndContext>

      <OrderModal
        show={modalOpen}
        boardId={boardId}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />

      <OrderDetailsModal
        show={Boolean(detailsOrderId)}
        order={detailsOrder}
        onClose={() => setDetailsOrderId(null)}
      />

      <AnalyticsModal
        show={analyticsOpen}
        boardId={boardId}
        onClose={() => setAnalyticsOpen(false)}
      />
    </div>
  );
}
