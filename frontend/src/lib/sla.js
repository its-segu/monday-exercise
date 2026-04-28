import { COMPLETED_STATUSES } from "../api/boardConstants";

const COMPLETED_SET = new Set(COMPLETED_STATUSES);

// Hard-coded for the take-home; in a real install this would come from a
// board setting or app settings JSON.
export const SLA_TARGET_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

const toMs = (raw) => {
  if (raw == null) return null;
  if (typeof raw === "number") return raw;
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : null;
};

// Earliest transition into a production-complete status (Ship or Done) per
// item. Later flips back-and-forth (rework) don't reset the SLA clock.
function buildCompletedAtIndex(statusHistory) {
  const earliest = new Map();
  for (const row of statusHistory) {
    if (!COMPLETED_SET.has(row.toLabel)) continue;
    const prev = earliest.get(row.itemId);
    if (prev == null || row.createdAt < prev) {
      earliest.set(row.itemId, row.createdAt);
    }
  }
  return earliest;
}

export function decorateOrdersWithSla(
  orders,
  statusHistory,
  { now = Date.now(), targetDays = SLA_TARGET_DAYS } = {},
) {
  const completedAtById = buildCompletedAtIndex(statusHistory || []);
  const targetMs = targetDays * DAY_MS;

  return (orders || []).map((order) => {
    const createdMs = toMs(order.createdAt);
    const completedMs = completedAtById.get(String(order.id)) ?? null;
    const isInFlight = !COMPLETED_SET.has(order.statusLabel);

    let turnaroundDays = null;
    if (createdMs != null && completedMs != null && completedMs >= createdMs) {
      turnaroundDays = (completedMs - createdMs) / DAY_MS;
    }

    let ageDays = null;
    if (createdMs != null) {
      const endMs = completedMs ?? now;
      ageDays = Math.max(0, (endMs - createdMs) / DAY_MS);
    }

    return {
      ...order,
      completedAt: completedMs,
      turnaroundDays,
      ageDays,
      onTime: turnaroundDays != null ? turnaroundDays <= targetDays : null,
      atRisk: isInFlight && createdMs != null && now - createdMs > targetMs,
    };
  });
}

export function summarizeSla(
  decoratedOrders,
  { targetDays = SLA_TARGET_DAYS } = {},
) {
  const total = decoratedOrders.length;
  const completed = decoratedOrders.filter((o) => o.completedAt != null);
  const inFlight = decoratedOrders.filter((o) => o.completedAt == null);

  const turnarounds = completed
    .map((o) => o.turnaroundDays)
    .filter((n) => Number.isFinite(n));
  const avgTurnaroundDays =
    turnarounds.length > 0
      ? turnarounds.reduce((s, n) => s + n, 0) / turnarounds.length
      : null;

  const onTime = completed.filter((o) => o.onTime === true).length;
  const onTimeRate = completed.length > 0 ? onTime / completed.length : null;

  const byStatus = decoratedOrders.reduce((acc, o) => {
    const key = o.statusLabel || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    targetDays,
    totals: {
      total,
      completed: completed.length,
      inFlight: inFlight.length,
      atRisk: inFlight.filter((o) => o.atRisk).length,
    },
    avgTurnaroundDays,
    onTimeRate,
    byStatus,
    throughput: buildThroughput(completed, 14),
  };
}

function buildThroughput(completedOrders, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const byDay = new Map();
  for (const order of completedOrders) {
    if (order.completedAt == null) continue;
    const d = new Date(order.completedAt);
    d.setHours(0, 0, 0, 0);
    byDay.set(d.getTime(), (byDay.get(d.getTime()) || 0) + 1);
  }
  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * DAY_MS);
    buckets.push({ date: d, count: byDay.get(d.getTime()) || 0 });
  }
  return buckets;
}

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
