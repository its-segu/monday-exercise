import { gql } from "./boardItems";
import { COLUMN_IDS, STATUS_LABELS } from "./boardConstants";

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

export async function createOrderItem(boardId, payload, fragranceNames) {
  const itemName =
    `${payload.firstName || "Order"} ${payload.lastName || ""}`.trim() ||
    "New order";

  const created = (
    await gql(CREATE_ITEM, { boardId: String(boardId), itemName })
  )?.create_item;
  if (!created?.id) throw new Error("create_item returned no item id");

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

export async function updateOrderStatus(boardId, itemId, statusLabel) {
  const data = await gql(SET_SIMPLE_VALUE, {
    boardId: String(boardId),
    itemId: String(itemId),
    columnId: COLUMN_IDS.status,
    value: String(statusLabel),
  });
  return data?.change_simple_column_value;
}
