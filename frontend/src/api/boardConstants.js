/**
 * Column IDs and option values for the live "Production Orders" board
 * (id 18410280508). Pulled from a one-time `getBoardSchema()` call against the
 * actual asset, not assumed.
 *
 * If you install this app on a different account, re-run that query and update
 * the IDs/labels below — see README.md → "Updating column IDs".
 */
export const COLUMN_IDS = {
  status: "status",
  fragrances: "dropdown",
  quantity: "numbers",
  firstName: "text",
  lastName: "text6",
  email: "email",
  phone: "phone",
  address: "location",
  inscription: "text5",
};

/**
 * Status labels exactly as they appear on the board. These are the column
 * headers in the Kanban view.
 */
export const STATUS_LABELS = {
  newOrder: "New Order",
  workingOnIt: "Working on it",
  done: "Done",
  stuck: "Stuck",
};

/**
 * Order in which Kanban columns are rendered, left-to-right.
 */
export const STATUS_ORDER = [
  STATUS_LABELS.newOrder,
  STATUS_LABELS.workingOnIt,
  STATUS_LABELS.done,
  STATUS_LABELS.stuck,
];
