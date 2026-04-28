import React, { memo } from "react";
import { Heading, Text } from "@vibe/core";
import { useDraggable } from "@dnd-kit/core";
import styles from "./KanbanView.module.scss";

const TAG_PALETTE = [
  { bg: "rgba(0, 115, 234, 0.16)", fg: "#0060b9" },
  { bg: "rgba(0, 200, 117, 0.18)", fg: "#007a47" },
  { bg: "rgba(253, 171, 61, 0.24)", fg: "#a96400" },
  { bg: "rgba(223, 47, 74, 0.16)", fg: "#b51c39" },
  { bg: "rgba(163, 88, 223, 0.18)", fg: "#7b3ad6" },
  { bg: "rgba(255, 21, 138, 0.14)", fg: "#c41273" },
  { bg: "rgba(0, 200, 200, 0.18)", fg: "#007e7e" },
  { bg: "rgba(127, 83, 71, 0.18)", fg: "#5e3d33" },
];

// Hash a label deterministically so the same fragrance always renders in the
// same color across cards.
function tagColorFor(label) {
  const text = String(label || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
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
          <Heading type="h3" weight="medium" maxLines={1}>
            {name || "Untitled order"}
          </Heading>
          <Text type="text2" className={styles.cardId}>
            #{id}
          </Text>
        </div>
      </div>

      {fragrances.length > 0 && (
        <div className={styles.fragranceList}>
          {fragrances.map((label, idx) => {
            const palette = tagColorFor(label);
            return (
              <span
                key={`${id}-${label}-${idx}`}
                className={styles.tag}
                style={{ "--tag-bg": palette.bg, "--tag-fg": palette.fg }}
              >
                {label}
              </span>
            );
          })}
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

// Lightweight clone rendered inside <DragOverlay> so the visual follows the
// cursor without mutating the source DOM node.
export function OrderCardOverlay({ order }) {
  return (
    <div className={`${styles.card} ${styles.cardDragOverlay}`}>
      <CardBody order={order} dragging />
    </div>
  );
}

function OrderCard({ order, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
    data: { order },
  });

  const className = `${styles.card}${isDragging ? ` ${styles.cardDragging}` : ""}`;
  const handleOpen = () => {
    if (!isDragging) onOpen?.(order.id);
  };

  return (
    <div
      ref={setNodeRef}
      className={className}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
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

export default memo(OrderCard);
