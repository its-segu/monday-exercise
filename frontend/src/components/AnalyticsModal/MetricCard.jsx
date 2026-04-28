import React, { memo } from "react";
import styles from "./AnalyticsModal.module.scss";

const MetricCard = memo(function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}) {
  return (
    <div className={`${styles.metricCard} ${styles[`tone-${tone}`]}`}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
      {hint && <span className={styles.metricHint}>{hint}</span>}
    </div>
  );
});

export default MetricCard;
