import React, { memo } from "react";
import { Text } from "@vibe/core";
import {
  STATUS_ORDER,
  STATUS_COLORS,
  STATUS_COLOR_FALLBACK,
} from "../../api/boardConstants";
import styles from "./AnalyticsModal.module.scss";

const PipelineBar = memo(function PipelineBar({ byStatus }) {
  const ordered = STATUS_ORDER.map((label) => ({
    label,
    count: byStatus[label] || 0,
    color: STATUS_COLORS[label] || STATUS_COLOR_FALLBACK,
  }));
  const total = ordered.reduce((s, b) => s + b.count, 0);

  if (total === 0) {
    return (
      <Text type="text2" color="secondary">
        No orders on the board yet.
      </Text>
    );
  }

  return (
    <div className={styles.pipeline}>
      <div
        className={styles.pipelineBar}
        role="img"
        aria-label="Pipeline distribution"
      >
        {ordered.map(({ label, count, color }) =>
          count === 0 ? null : (
            <span
              key={label}
              className={styles.pipelineSegment}
              style={{ flex: count, background: color }}
              title={`${label}: ${count}`}
            />
          ),
        )}
      </div>
      <div className={styles.pipelineLegend}>
        {ordered.map(({ label, count, color }) => (
          <span key={label} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: color }} />
            <span className={styles.legendLabel}>{label}</span>
            <span className={styles.legendCount}>{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
});

export default PipelineBar;
