import React from "react";
import { Heading, Text, IconButton } from "@vibe/core";
import { Add } from "@vibe/icons";
import { useDroppable } from "@dnd-kit/core";
import OrderCard from "./OrderCard";
import styles from "./KanbanView.module.scss";

const STATUS_COLORS = {
  "New Order": "#579bfc",
  "Working on it": "#fdab3d",
  Done: "#00c875",
  Stuck: "#df2f4a",
};

export default function KanbanColumn({ status, orders, onAddClick, onOpenCard }) {
  const accent = STATUS_COLORS[status] || "#c4c4c4";
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${status}`,
    data: { status },
  });

  const columnClassName = `${styles.column}${isOver ? ` ${styles.columnOver}` : ""}`;

  return (
    <div className={styles.columnWrapper}>
      <section
        ref={setNodeRef}
        className={columnClassName}
        aria-label={`${status} column`}
        style={{ "--column-accent": accent }}
      >
        <header className={styles.columnHeader}>
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
