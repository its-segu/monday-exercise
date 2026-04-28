import React from "react";
import {
  Modal,
  ModalContent,
  Text,
  Button,
  IconButton,
  Loader,
  AttentionBox,
} from "@vibe/core";
import { Retry } from "@vibe/icons";
import { formatDays, formatPercent, SLA_TARGET_DAYS } from "../../lib/sla";
import { STATUS_COLORS, STATUS_COLOR_FALLBACK } from "../../api/boardConstants";
import useAnalyticsData, { HISTORY_DAYS } from "./useAnalyticsData";
import MetricCard from "./MetricCard";
import PipelineBar from "./PipelineBar";
import ThroughputChart from "./ThroughputChart";
import styles from "./AnalyticsModal.module.scss";

function turnaroundTone(summary) {
  const v = summary.avgTurnaroundDays;
  if (v == null) return "neutral";
  return v <= summary.targetDays ? "good" : "warn";
}

function onTimeTone(rate) {
  if (rate == null) return "neutral";
  if (rate >= 0.9) return "good";
  if (rate >= 0.75) return "warn";
  return "bad";
}

function formatRelativeTime(ms) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m ago`;
  return new Date(ms).toLocaleTimeString();
}

export default function AnalyticsModal({ show, boardId, onClose }) {
  const {
    loading,
    refreshing,
    error,
    summary,
    atRiskList,
    hasHistory,
    lastRefreshedAt,
    refresh,
  } = useAnalyticsData(boardId, show);

  return (
    <Modal
      id="production-analytics-modal"
      show={show}
      onClose={onClose}
      title="Production performance"
      description={`Rolling ${HISTORY_DAYS}-day window · SLA target ${SLA_TARGET_DAYS} days`}
      closeButtonAriaLabel="Close"
      width="720px"
      contentSpacing
    >
      <ModalContent>
        <div className={styles.body}>
          <div className={styles.headerRow}>
            <Text type="text2" color="secondary">
              {lastRefreshedAt
                ? `Updated ${formatRelativeTime(lastRefreshedAt)}`
                : "Loading live data…"}
            </Text>
            <IconButton
              icon={Retry}
              size="small"
              kind="tertiary"
              ariaLabel="Refresh analytics"
              tooltipContent="Refresh"
              onClick={refresh}
              disabled={loading || refreshing || !boardId}
              className={refreshing ? styles.refreshing : undefined}
            />
          </div>

          {loading && (
            <div className={styles.loadingWrap}>
              <Loader size="medium" />
            </div>
          )}

          {error && !loading && (
            <AttentionBox
              type="danger"
              title="Could not load analytics"
              text={error}
            />
          )}

          {!loading && !error && (
            <>
              {!hasHistory && summary.totals.total > 0 && (
                <AttentionBox
                  compact
                  type="primary"
                  text="Status-change history unavailable, so turnaround can't be computed yet. Move an order through the pipeline to start tracking SLA."
                />
              )}

              <section className={styles.metricsRow}>
                <MetricCard
                  label="Avg turnaround"
                  value={formatDays(summary.avgTurnaroundDays)}
                  hint={`${summary.totals.completed} completed`}
                  tone={turnaroundTone(summary)}
                />
                <MetricCard
                  label="On-time rate"
                  value={formatPercent(summary.onTimeRate)}
                  hint={`Target ${summary.targetDays} d`}
                  tone={onTimeTone(summary.onTimeRate)}
                />
                <MetricCard
                  label="In flight"
                  value={String(summary.totals.inFlight)}
                  hint={
                    summary.totals.atRisk > 0
                      ? `${summary.totals.atRisk} past SLA`
                      : "all on schedule"
                  }
                  tone={summary.totals.atRisk > 0 ? "bad" : "good"}
                />
                <MetricCard
                  label="Total orders"
                  value={String(summary.totals.total)}
                  hint={`last ${HISTORY_DAYS} days`}
                  tone="neutral"
                />
              </section>

              <section className={styles.section}>
                <span className={styles.sectionLabel}>Pipeline snapshot</span>
                <PipelineBar byStatus={summary.byStatus} />
              </section>

              {summary.throughput.some((b) => b.count > 0) && (
                <section className={styles.section}>
                  <span className={styles.sectionLabel}>
                    Throughput · last 14 days
                  </span>
                  <ThroughputChart buckets={summary.throughput} />
                </section>
              )}

              <section className={styles.section}>
                <span className={styles.sectionLabel}>
                  Orders past SLA ({summary.totals.atRisk})
                </span>
                {atRiskList.length === 0 ? (
                  <Text type="text2" color="secondary">
                    Every in-flight order is within the {summary.targetDays}-day
                    target. Nice.
                  </Text>
                ) : (
                  <ul className={styles.riskList}>
                    {atRiskList.map((order) => (
                      <li key={order.id} className={styles.riskRow}>
                        <span
                          className={styles.riskDot}
                          style={{
                            background:
                              STATUS_COLORS[order.statusLabel] ||
                              STATUS_COLOR_FALLBACK,
                          }}
                          aria-hidden
                        />
                        <span className={styles.riskName}>
                          {order.name || `Order #${order.id}`}
                        </span>
                        <span className={styles.riskStatus}>
                          {order.statusLabel}
                        </span>
                        <span className={styles.riskAge}>
                          {formatDays(order.ageDays)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          <div className={styles.footer}>
            <Button kind="tertiary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
