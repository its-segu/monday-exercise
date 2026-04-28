import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  ModalContent,
  Heading,
  Text,
  Button,
  IconButton,
  Loader,
  AttentionBox,
} from "@vibe/core";
import { Retry } from "@vibe/icons";
import { getOrderItems, getStatusChangeHistory } from "../../api/boardQueries";
import {
  decorateOrdersWithSla,
  summarizeSla,
  formatDays,
  formatPercent,
  SLA_TARGET_DAYS,
} from "../../lib/sla";
import {
  STATUS_ORDER,
  STATUS_COLORS,
  STATUS_COLOR_FALLBACK,
} from "../../api/boardConstants";
import styles from "./AnalyticsModal.module.scss";

const HISTORY_DAYS = 90;
const AT_RISK_LIMIT = 6;

export default function AnalyticsModal({ show, boardId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const cancelRef = useRef(false);

  const fetchData = useCallback(
    async ({ silent = false } = {}) => {
      if (!boardId) return;
      cancelRef.current = false;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        // activity_logs requires `boards:read` and a recent API version. If
        // it fails we still render snapshot metrics from items_page so the
        // modal degrades gracefully.
        const [orderItems, statusHistory] = await Promise.all([
          getOrderItems(boardId),
          getStatusChangeHistory(boardId, { days: HISTORY_DAYS }).catch(
            (err) => {
              console.warn(
                "[AnalyticsModal] activity_logs unavailable:",
                err?.message,
              );
              return [];
            },
          ),
        ]);
        if (cancelRef.current) return;
        setOrders(orderItems || []);
        setHistory(statusHistory || []);
        setLastRefreshedAt(Date.now());
      } catch (err) {
        if (cancelRef.current) return;
        setError(err.message || "Could not load analytics");
      } finally {
        if (!cancelRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [boardId],
  );

  useEffect(() => {
    if (!show || !boardId) return undefined;
    fetchData();
    return () => {
      cancelRef.current = true;
    };
  }, [show, boardId, fetchData]);

  const decorated = useMemo(
    () =>
      decorateOrdersWithSla(orders, history, { targetDays: SLA_TARGET_DAYS }),
    [orders, history],
  );

  const summary = useMemo(
    () => summarizeSla(decorated, { targetDays: SLA_TARGET_DAYS }),
    [decorated],
  );

  const atRiskList = useMemo(
    () =>
      decorated
        .filter((o) => o.atRisk)
        .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0))
        .slice(0, AT_RISK_LIMIT),
    [decorated],
  );

  const handleRefresh = useCallback(
    () => fetchData({ silent: true }),
    [fetchData],
  );

  const hasHistory = history.length > 0;

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
              onClick={handleRefresh}
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
