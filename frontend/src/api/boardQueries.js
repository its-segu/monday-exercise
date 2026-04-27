import monday from "../lib/monday";
import { COLUMN_IDS, STATUS_LABELS } from "./boardConstants";

const API_VERSION = "2024-10";

async function gql(query, variables = {}) {
  const res = await monday.api(query, { variables, apiVersion: API_VERSION });
  if (res?.errors?.length) {
    const message = res.errors.map((e) => e.message || String(e)).join("; ");
    throw new Error(message);
  }
  return res?.data;
}

/**
 * One-time helper for development. Logs the columns + status options of a
 * board so we can wire up the right column IDs in `boardConstants.js`.
 */
export async function getBoardSchema(boardId) {
  const query = `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        id
        name
        columns {
          id
          title
          type
          settings_str
        }
      }
    }
  `;
  const data = await gql(query, { boardId: [String(boardId)] });
  const board = data?.boards?.[0];
  if (!board) return null;
  const statusColumn = board.columns.find((c) => c.id === COLUMN_IDS.status);
  let statusOptions = [];
  if (statusColumn?.settings_str) {
    try {
      const parsed = JSON.parse(statusColumn.settings_str);
      const labels = parsed?.labels || {};
      const colors = parsed?.labels_colors || {};
      statusOptions = Object.entries(labels).map(([index, label]) => ({
        index: Number(index),
        label,
        color: colors[index]?.color || null,
      }));
    } catch {
      statusOptions = [];
    }
  }
  return {
    id: board.id,
    name: board.name,
    columns: board.columns.map(({ id, title, type }) => ({ id, title, type })),
    statusOptions,
  };
}

/**
 * Fetch all order items from the board (paginated). Returns a normalized
 * shape that our Kanban can render directly.
 *
 * NOTE: We deliberately avoid GraphQL inline fragments (`... on StatusValue`,
 * `... on EmailValue`, etc.) on `column_values`. Inside the real monday
 * iframe `monday.api()` proxies the request through the parent window,
 * which doesn't honor the `apiVersion` option we set — so anything that
 * requires a recent schema version gets rejected as a "GraphQL validation
 * error". Sticking to `id` + `type` + `text` + `value` works on every
 * supported API version. Typed fields are recovered by parsing `value`
 * (always a JSON string) in `normalizeItem`.
 */
export async function getOrderItems(boardId) {
  const query = `
    query ($boardId: ID!, $limit: Int!, $cursor: String) {
      boards(ids: [$boardId]) {
        items_page(limit: $limit, cursor: $cursor) {
          cursor
          items {
            id
            name
            created_at
            column_values {
              id
              type
              text
              value
            }
          }
        }
      }
    }
  `;

  const all = [];
  let cursor = null;
  do {
    const data = await gql(query, {
      boardId: String(boardId),
      limit: 100,
      cursor,
    });
    const page = data?.boards?.[0]?.items_page;
    if (!page) break;
    all.push(...(page.items || []));
    cursor = page.cursor;
  } while (cursor);

  return all.map(normalizeItem);
}

// Safely parse a `column_values[].value` JSON string. Returns {} on null /
// empty / malformed input so callers can use optional chaining freely.
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
    (item.column_values || []).map((cv) => [cv.id, cv])
  );

  const statusCv = byId[COLUMN_IDS.status];
  const statusVal = parseValue(statusCv);
  // `text` is the human label (e.g. "New Order"), `value.label.text` is the
  // same on newer schemas. `value.index` is the numeric index.
  const statusLabel =
    statusCv?.text ||
    statusVal?.label?.text ||
    statusVal?.text ||
    STATUS_LABELS.newOrder;

  const fragrancesCv = byId[COLUMN_IDS.fragrances];
  const fragrancesVal = parseValue(fragrancesCv);
  let fragranceLabels = [];
  if (Array.isArray(fragrancesVal?.chosenValues)) {
    fragranceLabels = fragrancesVal.chosenValues
      .map((v) => v?.name || v?.label)
      .filter(Boolean);
  } else if (fragrancesCv?.text) {
    fragranceLabels = fragrancesCv.text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const quantityCv = byId[COLUMN_IDS.quantity];
  const quantityNum = Number(quantityCv?.text);

  const emailCv = byId[COLUMN_IDS.email];
  const emailVal = parseValue(emailCv);

  const phoneCv = byId[COLUMN_IDS.phone];

  const addressCv = byId[COLUMN_IDS.address];
  const addressVal = parseValue(addressCv);

  return {
    id: item.id,
    name: item.name,
    createdAt: item.created_at,
    statusLabel,
    fragrances: fragranceLabels,
    quantity: Number.isFinite(quantityNum) ? quantityNum : null,
    firstName: byId[COLUMN_IDS.firstName]?.text || "",
    lastName: byId[COLUMN_IDS.lastName]?.text || "",
    email: emailVal?.email || emailCv?.text || "",
    phone: phoneCv?.text || "",
    address: addressVal?.address || addressCv?.text || "",
    inscription: byId[COLUMN_IDS.inscription]?.text || "",
  };
}

/**
 * Build a list of [columnId, simpleValue] pairs from a form payload, using
 * the exact `change_simple_column_value` formats monday documents per column
 * type:
 *   - status:   label string ("New Order")
 *   - dropdown: comma-separated labels ("Smokey, Floral, Fresh")
 *   - numbers:  stringified number ("5")
 *   - text:     raw text
 *   - email:    "address@x.com display_text"  (BOTH tokens required)
 *   - phone:    digits only
 *   - location: "lat lng address"             (lat/lng required, default 0)
 */
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
    const address = String(payload.address).trim();
    updates.push([COLUMN_IDS.address, `0 0 ${address}`]);
  }
  if (payload.inscription)
    updates.push([COLUMN_IDS.inscription, String(payload.inscription)]);

  return updates;
}

// `create_labels_if_missing: true` lets us write new fragrance / status
// labels that don't yet exist on the board's dropdown / status columns.
// Required for the fragrance API to function as a real catalog: when a
// designer adds a new scent via the backend and picks it on an order, the
// board adopts the new label automatically.
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

/**
 * Create a new order item on the board.
 *
 * Strategy: create the item with **just a name** (no `column_values` JSON to
 * keep the create mutation's signature minimal across API versions), then
 * fill every column via individual `change_simple_column_value` calls. This
 * sidesteps both:
 *   - "GraphQL validation errors" caused by `column_values: JSON!` shape
 *     differences across API versions
 *   - "invalid value" errors from hand-crafting JSON for email / phone /
 *     location columns
 *
 * The very first `change_simple_column_value` writes the status to "New
 * Order" so the new card lands in the right Kanban column.
 *
 * @param {string|number} boardId
 * @param {object} payload   raw form values
 * @param {string[]} fragranceNames  resolved fragrance display names
 * @returns {Promise<{id: string, name: string}>}
 */
export async function createOrderItem(boardId, payload, fragranceNames) {
  const itemName =
    `${payload.firstName || "Order"} ${payload.lastName || ""}`.trim() ||
    "New order";

  const createMutation = `
    mutation ($boardId: ID!, $itemName: String!) {
      create_item(board_id: $boardId, item_name: $itemName) {
        id
        name
      }
    }
  `;

  const createdData = await gql(createMutation, {
    boardId: String(boardId),
    itemName,
  });
  const created = createdData?.create_item;
  if (!created?.id) {
    throw new Error("create_item returned no item id");
  }

  // Status first so the card lands in the New Order column, then everything else.
  const updates = [
    [COLUMN_IDS.status, STATUS_LABELS.newOrder],
    ...buildSimpleColumnUpdates(payload, fragranceNames),
  ];

  const failures = [];
  for (const [columnId, value] of updates) {
    try {
      await gql(SET_SIMPLE_VALUE, {
        boardId: String(boardId),
        itemId: String(created.id),
        columnId,
        value: String(value),
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[createOrderItem] could not set "${columnId}" =`,
        value,
        "—",
        err?.message
      );
      failures.push({ columnId, message: err?.message || String(err) });
    }
  }

  if (failures.length) {
    const partial = new Error(
      `Order created but ${failures.length} field(s) failed: ` +
        failures.map((f) => `${f.columnId} (${f.message})`).join("; ")
    );
    partial.partial = true;
    partial.itemId = created.id;
    partial.failures = failures;
    throw partial;
  }

  return created;
}

/**
 * Pull every status-column change on the board for the last `days` days.
 *
 * Why we read raw activity_logs instead of a derived "Completed at" board
 * column: monday's no-code Formula columns can't reach status-change history,
 * but the activity log already captures every transition with a server-side
 * timestamp — so we get a "completed at" for free for every order without
 * touching the board schema.
 *
 * Returns the parsed log rows with the most useful fields lifted out:
 *   { itemId, createdAt, fromLabel, toLabel }
 */
export async function getStatusChangeHistory(boardId, { days = 90 } = {}) {
  const fromIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const query = `
    query ($boardId: [ID!], $from: ISO8601DateTime, $columnIds: [String]) {
      boards(ids: $boardId) {
        activity_logs(
          from: $from
          column_ids: $columnIds
          limit: 10000
        ) {
          id
          event
          data
          entity
          created_at
        }
      }
    }
  `;

  const data = await gql(query, {
    boardId: [String(boardId)],
    from: fromIso,
    columnIds: [COLUMN_IDS.status],
  });

  const rows = data?.boards?.[0]?.activity_logs || [];
  return rows
    .map((row) => parseStatusLog(row))
    .filter((row) => row && row.itemId && row.toLabel);
}

// `created_at` from activity_logs comes back as a stringified integer
// epoch, but the unit varies by API version. Empirically it's been seen
// as 100-nanosecond ticks (e.g. 17144040000000000 for April 2024),
// microseconds, or already-milliseconds. Normalize to ms by magnitude
// so we don't have to guess the schema version up front:
//
//   ~1.7e18  →  nanoseconds            (÷ 1e6)
//   ~1.7e16  →  100-nanosecond ticks   (÷ 1e4)   ← monday's current shape
//   ~1.7e15  →  microseconds           (÷ 1e3)
//   ~1.7e12  →  milliseconds           (no-op)
//   ~1.7e9   →  seconds                (× 1e3)
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
  if (node.label?.text) return node.label.text;
  if (node.text) return node.text;
  if (node.value?.label?.text) return node.value.label.text;
  return null;
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
  if (!itemId) return null;

  const toLabel = extractStatusLabel(parsed.value);
  const fromLabel = extractStatusLabel(parsed.previous_value);
  const ts = activityTimestampToMs(row.created_at);
  if (!ts) return null;

  return {
    itemId: String(itemId),
    createdAt: ts,
    fromLabel,
    toLabel,
  };
}

/**
 * Move an item to a new status by writing the status column's label.
 * Used for kanban drag-and-drop.
 */
export async function updateOrderStatus(boardId, itemId, statusLabel) {
  const data = await gql(SET_SIMPLE_VALUE, {
    boardId: String(boardId),
    itemId: String(itemId),
    columnId: COLUMN_IDS.status,
    value: String(statusLabel),
  });

  return data?.change_simple_column_value;
}
