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

export const STATUS_LABELS = {
  newOrder: "New Order",
  workingOnIt: "Working on it",
  ship: "Ship",
  done: "Done",
  stuck: "Stuck",
};

export const STATUS_ORDER = [
  STATUS_LABELS.newOrder,
  STATUS_LABELS.workingOnIt,
  STATUS_LABELS.ship,
  STATUS_LABELS.done,
  STATUS_LABELS.stuck,
];

export const STATUS_COLORS = {
  [STATUS_LABELS.newOrder]: "#579bfc",
  [STATUS_LABELS.workingOnIt]: "#fdab3d",
  [STATUS_LABELS.ship]: "#a358df",
  [STATUS_LABELS.done]: "#00c875",
  [STATUS_LABELS.stuck]: "#df2f4a",
};

export const STATUS_COLOR_FALLBACK = "#c4c4c4";

// Production team's clock stops at "Ship" — carrier transit is out of scope.
export const COMPLETED_STATUSES = [STATUS_LABELS.ship, STATUS_LABELS.done];
