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

const BOARD_SCHEMA_QUERY = `
  query ($boardId: ID!) {
    boards(ids: [$boardId]) {
      name
      columns { id title type settings_str }
    }
  }
`;

export async function getBoardSchema(boardId) {
  const data = await gql(BOARD_SCHEMA_QUERY, { boardId: String(boardId) });
  return data?.boards?.[0] || null;
}

export { gql, API_VERSION };
