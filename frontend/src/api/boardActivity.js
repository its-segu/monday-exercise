import { gql } from "./boardItems";
import { COLUMN_IDS } from "./boardConstants";

const ACTIVITY_LOGS_QUERY = `
  query ($boardId: [ID!], $from: ISO8601DateTime, $columnIds: [String]) {
    boards(ids: $boardId) {
      activity_logs(from: $from, column_ids: $columnIds, limit: 10000) {
        id
        event
        data
        entity
        created_at
      }
    }
  }
`;

export async function getStatusChangeHistory(boardId, { days = 90 } = {}) {
  const fromIso = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();
  const data = await gql(ACTIVITY_LOGS_QUERY, {
    boardId: [String(boardId)],
    from: fromIso,
    columnIds: [COLUMN_IDS.status],
  });
  return (data?.boards?.[0]?.activity_logs || [])
    .map(parseStatusLog)
    .filter((row) => row?.itemId && row.toLabel);
}

// activity_logs `created_at` is a stringified integer, but the unit varies by
// API version. Normalize by magnitude so we don't have to detect the schema:
//   ~1.7e18 → ns           (÷ 1e6)
//   ~1.7e16 → 100-ns ticks (÷ 1e4)   ← monday's current shape
//   ~1.7e15 → µs           (÷ 1e3)
//   ~1.7e12 → ms           (no-op)
//   ~1.7e9  → s            (× 1e3)
function activityTimestampToMs(raw) {
  if (raw == null) return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    if (n > 1e17) return Math.round(n / 1e6);
    if (n > 1e15) return Math.round(n / 1e4);
    if (n > 1e13) return Math.round(n / 1e3);
    if (n > 1e11) return n;
    if (n > 1e8) return n * 1e3;
  }
  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractStatusLabel(node) {
  if (!node) return null;
  if (typeof node === "string") return node;
  return node.label?.text || node.text || node.value?.label?.text || null;
}

function parseStatusLog(row) {
  if (!row?.data) return null;
  let parsed;
  try {
    parsed = JSON.parse(row.data);
  } catch {
    return null;
  }
  if (parsed.column_id && parsed.column_id !== COLUMN_IDS.status) return null;

  const itemId = parsed.pulse_id ?? parsed.item_id ?? parsed.entity_id;
  const ts = activityTimestampToMs(row.created_at);
  if (!itemId || !ts) return null;

  return {
    itemId: String(itemId),
    createdAt: ts,
    fromLabel: extractStatusLabel(parsed.previous_value),
    toLabel: extractStatusLabel(parsed.value),
  };
}
