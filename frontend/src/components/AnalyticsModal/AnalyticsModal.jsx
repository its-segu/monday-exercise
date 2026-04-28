import React, {
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
import { STATUS_LABELS, STATUS_ORDER } from "../../api/boardConstants";
import styles from "./AnalyticsModal.module.scss";

const STATUS_COLORS = {
  [STATUS_LABELS.newOrder]: "#579bfc",
  [STATUS_LABELS.workingOnIt]: "#fdab3d",
  [STATUS_LABELS.ship]: "#a358df",
  [STATUS_LABELS.done]: "#00c875",
  [STATUS_LABELS.stuck]: "#df2f4a",
};

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
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [orderItems, statusHistory] = await Promise.all([
          getOrderItems(boardId),
          getStatusChangeHistory(boardId, { days: 90 }).catch((err) => {
            // Activity logs require boards:read on the deployed app and a
            // recent enough API version; if it fails, we still render the
            // snapshot metrics from items_page so the modal degrades
            // gracefully.
            // eslint-disable-next-line no-console
            console.warn(
              "[AnalyticsModal] activity_logs unavailable:",
              err?.message,
            );
            return [];
          }),
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
        .slice(0, 6),
    [decorated],
  );

  const hasHistory = history.length > 0;

  return (
    <Modal
      id="production-analytics-modal"
      show={show}
      onClose={onClose}
      title="Production performance"
      description={`Rolling 90-day window · SLA target ${SLA_TARGET_DAYS} days`}
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
              onClick={() => fetchData({ silent: true })}
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
                  tone={
                    summary.avgTurnaroundDays != null &&
                    summary.avgTurnaroundDays <= summary.targetDays
                      ? "good"
                      : summary.avgTurnaroundDays != null
                        ? "warn"
                        : "neutral"
                  }
                />
                <MetricCard
                  label="On-time rate"
                  value={formatPercent(summary.onTimeRate)}
                  hint={`Target ${summary.targetDays} d`}
                  tone={
                    summary.onTimeRate == null
                      ? "neutral"
                      : summary.onTimeRate >= 0.9
                        ? "good"
                        : summary.onTimeRate >= 0.75
                          ? "warn"
                          : "bad"
                  }
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
                  hint="last 90 days"
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
                              STATUS_COLORS[order.statusLabel] || "#c4c4c4",
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

function formatRelativeTime(ms) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m ago`;
  return new Date(ms).toLocaleTimeString();
}

function MetricCard({ label, value, hint, tone = "neutral" }) {
  return (
    <div className={`${styles.metricCard} ${styles[`tone-${tone}`]}`}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
      {hint && <span className={styles.metricHint}>{hint}</span>}
    </div>
  );
}

function PipelineBar({ byStatus }) {
  const ordered = STATUS_ORDER.map((label) => ({
    label,
    count: byStatus[label] || 0,
    color: STATUS_COLORS[label] || "#c4c4c4",
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
              style={{
                flex: count,
                background: color,
              }}
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
}

function ThroughputChart({ buckets }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div
      className={styles.chart}
      role="img"
      aria-label="Daily order completions"
    >
      {buckets.map((bucket, idx) => {
        const heightPct = (bucket.count / max) * 100;
        return (
          <span
            key={idx}
            className={styles.chartCol}
            title={`${bucket.date.toLocaleDateString()}: ${bucket.count} shipped`}
          >
            <span
              className={styles.chartBar}
              style={{ height: `${Math.max(2, heightPct)}%` }}
            />
            {(idx === 0 || idx === buckets.length - 1) && (
              <span className={styles.chartTick}>
                {bucket.date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
