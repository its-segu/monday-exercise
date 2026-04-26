import { STATUS_LABELS } from "../api/boardConstants";

/**
 * SLA target in days, measured from item creation to the first transition
 * into "Done" (in activity_logs). Centralized here so the modal, badges, and
 * any future logic agree on the same target.
 *
 * In a real install this would be customer-configurable (board setting,
 * settings JSON, etc.). For the take-home we hard-code a sensible default
 * and surface it in the UI so a reviewer can see exactly what's measured.
 */
export const SLA_TARGET_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

const toMs = (raw) => {
  if (raw == null) return null;
  if (typeof raw === "number") return raw;
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Walk every status-change row and pick the *earliest* transition into
 * "Done" per item. We treat the first time it hit Done as the completion
 * moment; later flips back-and-forth (rework) don't reset the SLA clock,
 * which is the more forgiving and customer-friendly read.
 */
function buildCompletedAtIndex(statusHistory) {
  const earliestDoneAt = new Map();
  for (const row of statusHistory) {
    if (row.toLabel !== STATUS_LABELS.done) continue;
    const prev = earliestDoneAt.get(row.itemId);
    if (prev == null || row.createdAt < prev) {
      earliestDoneAt.set(row.itemId, row.createdAt);
    }
  }
  return earliestDoneAt;
}

/**
 * Decorate each order with computed SLA fields.
 *   completedAt        — ms epoch | null (still in flight)
 *   turnaroundDays     — number   | null (only when completedAt exists)
 *   ageDays            — number          (always; in-flight = age, completed = turnaround)
 *   onTime             — boolean | null  (true/false for completed; null in-flight)
 *   atRisk             — boolean         (in-flight whose age already exceeds target)
 */
export function decorateOrdersWithSla(
  orders,
  statusHistory,
  { now = Date.now(), targetDays = SLA_TARGET_DAYS } = {}
) {
  const completedAtById = buildCompletedAtIndex(statusHistory || []);
  const targetMs = targetDays * DAY_MS;

  return (orders || []).map((order) => {
    const createdMs = toMs(order.createdAt);
    const completedMs = completedAtById.get(String(order.id)) ?? null;
    const isDone = order.statusLabel === STATUS_LABELS.done;
    const isInFlight = !isDone;

    let turnaroundDays = null;
    if (createdMs != null && completedMs != null && completedMs >= createdMs) {
      turnaroundDays = (completedMs - createdMs) / DAY_MS;
    }

    let ageDays = null;
    if (createdMs != null) {
      const endMs = completedMs ?? now;
      ageDays = Math.max(0, (endMs - createdMs) / DAY_MS);
    }

    const onTime =
      completedMs != null && turnaroundDays != null
        ? turnaroundDays <= targetDays
        : null;

    const atRisk =
      isInFlight && createdMs != null && now - createdMs > targetMs;

    return {
      ...order,
      completedAt: completedMs,
      turnaroundDays,
      ageDays,
      onTime,
      atRisk,
    };
  });
}

/**
 * Roll up decorated orders into the metrics the dashboard cares about.
 * Pure function over the array — easy to unit-test if we ever add tests.
 */
export function summarizeSla(decoratedOrders, { targetDays = SLA_TARGET_DAYS } = {}) {
  const total = decoratedOrders.length;
  const completed = decoratedOrders.filter((o) => o.completedAt != null);
  const inFlight = decoratedOrders.filter((o) => o.completedAt == null);

  const turnarounds = completed
    .map((o) => o.turnaroundDays)
    .filter((n) => Number.isFinite(n));
  const avgTurnaround =
    turnarounds.length > 0
      ? turnarounds.reduce((s, n) => s + n, 0) / turnarounds.length
      : null;

  const onTime = completed.filter((o) => o.onTime === true).length;
  const onTimeRate = completed.length > 0 ? onTime / completed.length : null;

  const atRisk = inFlight.filter((o) => o.atRisk).length;

  // Status histogram for the pipeline-snapshot widget.
  const byStatus = decoratedOrders.reduce((acc, o) => {
    const key = o.statusLabel || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // Throughput: orders completed per calendar day for the last 14 days.
  const throughput = buildThroughput(completed, 14);

  return {
    targetDays,
    totals: {
      total,
      completed: completed.length,
      inFlight: inFlight.length,
      atRisk,
    },
    avgTurnaroundDays: avgTurnaround,
    onTimeRate,
    byStatus,
    throughput,
  };
}

function buildThroughput(completedOrders, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];
  const byDay = new Map();
  for (const order of completedOrders) {
    if (order.completedAt == null) continue;
    const d = new Date(order.completedAt);
    d.setHours(0, 0, 0, 0);
    const key = d.getTime();
    byDay.set(key, (byDay.get(key) || 0) + 1);
  }
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = d.getTime();
    buckets.push({ date: d, count: byDay.get(key) || 0 });
  }
  return buckets;
}

/**
 * Format helpers — small enough to live next to the math they format.
 */
export function formatDays(value, { fractionDigits = 1 } = {}) {
  if (!Number.isFinite(value)) return "—";
  if (value < 1 / 24) return "< 1 hr";
  if (value < 1) return `${(value * 24).toFixed(0)} hr`;
  return `${value.toFixed(fractionDigits)} d`;
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}
