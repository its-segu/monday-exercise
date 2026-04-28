import monday from "../lib/monday";
import { COLUMN_IDS, STATUS_LABELS } from "./boardConstants";

const API_VERSION = "2024-10";
const PAGE_SIZE = 100;

async function gql(query, variables = {}) {
  const res = await monday.api(query, { variables, apiVersion: API_VERSION });
  if (res?.errors?.length) {
    throw new Error(res.errors.map((e) => e.message || String(e)).join("; "));
  }
  return res?.data;
}

// Inside the monday iframe, `monday.api()` proxies through the parent window
// and ignores `apiVersion`, so any GraphQL feature that requires a recent
// schema (typed `... on StatusValue` fragments, etc.) gets rejected. Sticking
// to id/type/text/value works on every API version; typed fields are
// recovered by parsing `value` (always a JSON string) in `normalizeItem`.
const ITEMS_PAGE_QUERY = `
  query ($boardId: ID!, $limit: Int!, $cursor: String) {
    boards(ids: [$boardId]) {
      items_page(limit: $limit, cursor: $cursor) {
        cursor
        items {
          id
          name
          created_at
          column_values { id type text value }
        }
      }
    }
  }
`;

export async function getOrderItems(boardId) {
  const all = [];
  let cursor = null;
  do {
    const data = await gql(ITEMS_PAGE_QUERY, {
      boardId: String(boardId),
      limit: PAGE_SIZE,
      cursor,
    });
    const page = data?.boards?.[0]?.items_page;
    if (!page) break;
    all.push(...(page.items || []));
    cursor = page.cursor;
  } while (cursor);

  return all.map(normalizeItem);
}

function parseValue(cv) {
  if (!cv?.value) return {};
  try {
    return JSON.parse(cv.value);
  } catch {
    return {};
  }
}

function normalizeItem(item) {
  const byId = Object.fromEntries(
    (item.column_values || []).map((cv) => [cv.id, cv]),
  );

  const statusCv = byId[COLUMN_IDS.status];
  const statusVal = parseValue(statusCv);
  const statusLabel =
    statusCv?.text ||
    statusVal?.label?.text ||
    statusVal?.text ||
    STATUS_LABELS.newOrder;

  const fragrancesCv = byId[COLUMN_IDS.fragrances];
  const fragrancesVal = parseValue(fragrancesCv);
  let fragrances = [];
  if (Array.isArray(fragrancesVal?.chosenValues)) {
    fragrances = fragrancesVal.chosenValues
      .map((v) => v?.name || v?.label)
      .filter(Boolean);
  } else if (fragrancesCv?.text) {
    fragrances = fragrancesCv.text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const quantity = Number(byId[COLUMN_IDS.quantity]?.text);
  const emailCv = byId[COLUMN_IDS.email];
  const emailVal = parseValue(emailCv);
  const addressCv = byId[COLUMN_IDS.address];
  const addressVal = parseValue(addressCv);

  return {
    id: item.id,
    name: item.name,
    createdAt: item.created_at,
    statusLabel,
    fragrances,
    quantity: Number.isFinite(quantity) ? quantity : null,
    firstName: byId[COLUMN_IDS.firstName]?.text || "",
    lastName: byId[COLUMN_IDS.lastName]?.text || "",
    email: emailVal?.email || emailCv?.text || "",
    phone: byId[COLUMN_IDS.phone]?.text || "",
    address: addressVal?.address || addressCv?.text || "",
    inscription: byId[COLUMN_IDS.inscription]?.text || "",
  };
}

// `change_simple_column_value` formats per column type:
//   status   → label string         dropdown → comma-separated labels
//   numbers  → stringified number   text     → raw text
//   email    → "addr displaytext"   phone    → digits only
//   location → "lat lng address"    (lat/lng required, default 0)
function buildSimpleColumnUpdates(payload, fragranceNames) {
  const updates = [];

  if (fragranceNames?.length) {
    updates.push([COLUMN_IDS.fragrances, fragranceNames.join(", ")]);
  }
  if (payload.quantity != null && payload.quantity !== "") {
    updates.push([COLUMN_IDS.quantity, String(payload.quantity)]);
  }
  if (payload.firstName)
    updates.push([COLUMN_IDS.firstName, String(payload.firstName)]);
  if (payload.lastName)
    updates.push([COLUMN_IDS.lastName, String(payload.lastName)]);
  if (payload.email) {
    const email = String(payload.email).trim();
    updates.push([COLUMN_IDS.email, `${email} ${email}`]);
  }
  if (payload.phone) {
    const digits = String(payload.phone).replace(/\D+/g, "");
    if (digits) updates.push([COLUMN_IDS.phone, digits]);
  }
  if (payload.address) {
    updates.push([COLUMN_IDS.address, `0 0 ${String(payload.address).trim()}`]);
  }
  if (payload.inscription)
    updates.push([COLUMN_IDS.inscription, String(payload.inscription)]);

  return updates;
}

// `create_labels_if_missing: true` lets the board adopt new fragrance/status
// labels added via the API without manual board admin work.
const SET_SIMPLE_VALUE = `
  mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: String!) {
    change_simple_column_value(
      board_id: $boardId,
      item_id: $itemId,
      column_id: $columnId,
      value: $value,
      create_labels_if_missing: true
    ) { id }
  }
`;

const CREATE_ITEM = `
  mutation ($boardId: ID!, $itemName: String!) {
    create_item(board_id: $boardId, item_name: $itemName) {
      id
      name
    }
  }
`;

export async function createOrderItem(boardId, payload, fragranceNames) {
  const itemName =
    `${payload.firstName || "Order"} ${payload.lastName || ""}`.trim() ||
    "New order";

  const created = (
    await gql(CREATE_ITEM, { boardId: String(boardId), itemName })
  )?.create_item;
  if (!created?.id) throw new Error("create_item returned no item id");

  // Status writes first so the card lands in the New Order column. The rest
  // run in parallel — they're independent column writes against the same
  // item, so there's no ordering guarantee to preserve.
  await gql(SET_SIMPLE_VALUE, {
    boardId: String(boardId),
    itemId: String(created.id),
    columnId: COLUMN_IDS.status,
    value: STATUS_LABELS.newOrder,
  });

  const updates = buildSimpleColumnUpdates(payload, fragranceNames);
  const results = await Promise.allSettled(
    updates.map(([columnId, value]) =>
      gql(SET_SIMPLE_VALUE, {
        boardId: String(boardId),
        itemId: String(created.id),
        columnId,
        value: String(value),
      }),
    ),
  );

  const failures = results.flatMap((r, i) =>
    r.status === "rejected"
      ? [
          {
            columnId: updates[i][0],
            message: r.reason?.message || String(r.reason),
          },
        ]
      : [],
  );

  if (failures.length) {
    const partial = new Error(
      `Order created but ${failures.length} field(s) failed: ` +
        failures.map((f) => `${f.columnId} (${f.message})`).join("; "),
    );
    partial.partial = true;
    partial.itemId = created.id;
    partial.failures = failures;
    throw partial;
  }

  return created;
}

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

export async function updateOrderStatus(boardId, itemId, statusLabel) {
  const data = await gql(SET_SIMPLE_VALUE, {
    boardId: String(boardId),
    itemId: String(itemId),
    columnId: COLUMN_IDS.status,
    value: String(statusLabel),
  });
  return data?.change_simple_column_value;
}
