import React from "react";
import { Heading, Text, Chips } from "@vibe/core";
import { useDraggable } from "@dnd-kit/core";
import styles from "./KanbanView.module.scss";

const CHIP_COLORS = ["primary", "positive", "negative", "warning", "secondary"];

function chipColor(index) {
  return CHIP_COLORS[index % CHIP_COLORS.length];
}

function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function CardBody({ order, dragging }) {
  const { id, name, fragrances = [], quantity, createdAt } = order;
  return (
    <>
      <div className={styles.cardTopRow}>
        <div className={styles.cardTitle}>
          <Heading type="h3" weight="bold" maxLines={1}>
            {name || "Untitled order"}
          </Heading>
          <Text type="text2" className={styles.cardId}>
            #{id}
          </Text>
        </div>
      </div>

      {fragrances.length > 0 && (
        <div className={styles.fragranceList}>
          {fragrances.map((label, idx) => (
            <Chips
              key={`${id}-${label}-${idx}`}
              label={label}
              color={chipColor(idx)}
              readOnly
              noAnimation
            />
          ))}
        </div>
      )}

      <div className={styles.cardFooter}>
        <span className={styles.quantity}>
          <Text type="text2" element="span" color="secondary">
            Qty
          </Text>
          <Text type="text1" element="span" weight="bold">
            {quantity ?? "—"}
          </Text>
        </span>
        {!dragging && (
          <Text type="text2" color="secondary">
            {relativeTime(createdAt)}
          </Text>
        )}
      </div>
    </>
  );
}

/**
 * Lightweight, non-interactive variant used inside <DragOverlay>. We render
 * a clone so the card visually follows the cursor without touching the
 * original DOM node (dnd-kit handles transform on the clone).
 */
export function OrderCardOverlay({ order }) {
  return (
    <div className={`${styles.card} ${styles.cardDragOverlay}`}>
      <CardBody order={order} dragging />
    </div>
  );
}

export default function OrderCard({ order, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
    data: { order },
  });

  const className = `${styles.card}${isDragging ? ` ${styles.cardDragging}` : ""}`;

  return (
    <div
      ref={setNodeRef}
      className={className}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!isDragging) onOpen?.(order.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(order.id);
        }
      }}
      {...attributes}
      {...listeners}
    >
      <CardBody order={order} dragging={isDragging} />
    </div>
  );
}
