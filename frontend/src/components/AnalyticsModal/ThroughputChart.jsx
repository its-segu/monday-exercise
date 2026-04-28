import React, { memo } from "react";
import styles from "./AnalyticsModal.module.scss";

const ThroughputChart = memo(function ThroughputChart({ buckets }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const lastIdx = buckets.length - 1;
  return (
    <div
      className={styles.chart}
      role="img"
      aria-label="Daily order completions"
    >
      {buckets.map((bucket, idx) => (
        <span
          key={idx}
          className={styles.chartCol}
          title={`${bucket.date.toLocaleDateString()}: ${bucket.count} shipped`}
        >
          <span
            className={styles.chartBar}
            style={{ height: `${Math.max(2, (bucket.count / max) * 100)}%` }}
          />
          {(idx === 0 || idx === lastIdx) && (
            <span className={styles.chartTick}>
              {bucket.date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </span>
      ))}
    </div>
  );
});

export default ThroughputChart;
