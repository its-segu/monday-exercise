import React, { memo } from "react";
import { Heading, Text, IconButton } from "@vibe/core";
import { Add, Drag } from "@vibe/icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import OrderCard from "./OrderCard";
import { STATUS_COLORS, STATUS_COLOR_FALLBACK } from "../../api/boardConstants";
import styles from "./KanbanView.module.scss";

function KanbanColumn({
  status,
  orders,
  onAddClick,
  onOpenCard,
  activeDragType,
}) {
  const accent = STATUS_COLORS[status] || STATUS_COLOR_FALLBACK;
  const {
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    attributes,
    listeners,
  } = useSortable({
    id: status,
    data: { type: "column", status },
  });

  // Highlight the column only when a card is being dropped — column-on-column
  // drags get their visual cue from sortable's slide animation instead.
  const showCardDropHighlight = isOver && activeDragType === "card";

  const className = [
    styles.column,
    showCardDropHighlight ? styles.columnOver : "",
    isDragging ? styles.columnDragging : "",
  ]
    .filter(Boolean)
    .join(" ");

  const wrapperStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} className={styles.columnWrapper} style={wrapperStyle}>
      <section
        className={className}
        aria-label={`${status} column`}
        style={{ "--column-accent": accent }}
      >
        <header
          ref={setActivatorNodeRef}
          className={styles.columnHeader}
          {...attributes}
          {...listeners}
          style={{ touchAction: "pan-x pan-y" }}
        >
          <span className={styles.columnGrip} aria-hidden>
            <Drag />
          </span>
          <div className={styles.columnTitle}>
            <Heading type="h3" weight="medium" maxLines={1}>
              {status}
            </Heading>
            <span className={styles.columnCount}>{orders.length}</span>
          </div>
          {onAddClick && (
            <IconButton
              className={styles.addButton}
              icon={Add}
              size="xs"
              kind="tertiary"
              ariaLabel="Add new order"
              tooltipContent="Add new order"
              onClick={onAddClick}
              // Stop pointer events from reaching the sortable activator.
              onPointerDown={(e) => e.stopPropagation()}
            />
          )}
        </header>

        <div className={styles.cardList}>
          {orders.length === 0 ? (
            <div className={styles.emptyHint}>
              <Text type="text2" color="secondary">
                {onAddClick
                  ? "Click + to start a new order, or drop a card here"
                  : "Drop a card here"}
              </Text>
            </div>
          ) : (
            orders.map((order) => (
              <OrderCard key={order.id} order={order} onOpen={onOpenCard} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default memo(KanbanColumn);
