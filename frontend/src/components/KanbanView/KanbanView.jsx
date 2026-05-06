import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader, AttentionBox } from "@vibe/core";
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
import { STATUS_LABELS, STATUS_ORDER } from "../../api/boardConstants";
import useKanbanBoard from "./useKanbanBoard";
import KanbanColumn from "./KanbanColumn";
import { OrderCardOverlay } from "./OrderCard";
import OrderModal from "../OrderModal/OrderModal";
import OrderDetailsModal from "../OrderDetailsModal/OrderDetailsModal";
import AnalyticsModal from "../AnalyticsModal/AnalyticsModal";
import styles from "./KanbanView.module.scss";

const COLUMN_ORDER_KEY = "monday-candle:columnOrder";

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

export default function KanbanView({
  orderModalOpen,
  setOrderModalOpen,
  analyticsOpen,
  setAnalyticsOpen,
  onBoardReady,
}) {
  const {
    boardId,
    orders,
    loading,
    error,
    grouped,
    moveCardStatus,
    handleCreated,
  } = useKanbanBoard();

  const [activeItem, setActiveItem] = useState(null);
  const [detailsOrderId, setDetailsOrderId] = useState(null);
  const [columnOrder, setColumnOrder] = useState(loadColumnOrder);
  const kanbanBodyRef = useRef(null);

  useEffect(() => {
    onBoardReady(Boolean(boardId));
  }, [boardId, onBoardReady]);

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
  // isn't over a column that can absorb the scroll itself.
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  const detailsOrder = orders.find((o) => o.id === detailsOrderId) || null;

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

  const handleDragCancel = useCallback(() => setActiveItem(null), []);

  const handleDragEnd = useCallback(
    (event) => {
      setActiveItem(null);
      const { active, over } = event;
      if (!over) return;

      if (active.data?.current?.type === "column") {
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

      const itemId = active.id;
      const targetStatus = over.data?.current?.status || over.id;
      if (!itemId || !targetStatus || !boardId) return;
      if (!STATUS_ORDER.includes(targetStatus)) return;
      moveCardStatus(itemId, targetStatus);
    },
    [boardId, moveCardStatus],
  );

  const handleOpenNewOrder = useCallback(() => setOrderModalOpen(true), [setOrderModalOpen]);
  const handleCloseNewOrder = useCallback(() => setOrderModalOpen(false), [setOrderModalOpen]);
  const handleCloseAnalytics = useCallback(() => setAnalyticsOpen(false), [setAnalyticsOpen]);
  const handleOpenCard = useCallback((id) => setDetailsOrderId(id), []);
  const handleCloseDetails = useCallback(() => setDetailsOrderId(null), []);

  const onCreated = useCallback(
    async (newItem, meta) => {
      await handleCreated(newItem, meta);
      setOrderModalOpen(false);
    },
    [handleCreated, setOrderModalOpen],
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

  const activeType = activeItem?.type || null;

  return (
    <div className={styles.kanbanRoot}>
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
        show={orderModalOpen}
        boardId={boardId}
        onClose={handleCloseNewOrder}
        onCreated={onCreated}
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
