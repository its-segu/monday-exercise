import React, { memo } from "react";
import { Heading, Text, IconButton } from "@vibe/core";
import { Add } from "@vibe/icons";
import { useDroppable } from "@dnd-kit/core";
import OrderCard from "./OrderCard";
import { STATUS_COLORS, STATUS_COLOR_FALLBACK } from "../../api/boardConstants";
import styles from "./KanbanView.module.scss";

function KanbanColumn({ status, orders, onAddClick, onOpenCard }) {
  const accent = STATUS_COLORS[status] || STATUS_COLOR_FALLBACK;
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${status}`,
    data: { status },
  });

  const className = `${styles.column}${isOver ? ` ${styles.columnOver}` : ""}`;

  return (
    <div className={styles.columnWrapper}>
      <section
        ref={setNodeRef}
        className={className}
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

export default memo(KanbanColumn);
