const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s().-]{6,}$/;

export const REQUIRED_FRAGRANCE_COUNT = 3;
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 100;
export const MAX_INSCRIPTION_LENGTH = 60;

function isBlank(value) {
  return typeof value !== "string" || value.trim().length === 0;
}

export function validateOrder(values) {
  const errors = {};

  if (isBlank(values.firstName)) errors.firstName = "First name is required";
  if (isBlank(values.lastName)) errors.lastName = "Last name is required";

  if (isBlank(values.email)) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(values.email.trim())) {
    errors.email = "Enter a valid email";
  }

  if (isBlank(values.phone)) {
    errors.phone = "Phone is required";
  } else if (!PHONE_RE.test(values.phone.trim())) {
    errors.phone = "Enter a valid phone number";
  }

  if (isBlank(values.address)) errors.address = "Shipping address is required";

  const fragrances = Array.isArray(values.fragrances) ? values.fragrances : [];
  const filled = fragrances.filter(Boolean);
  const unique = new Set(filled);
  if (filled.length < REQUIRED_FRAGRANCE_COUNT) {
    errors.fragrances = `Pick ${REQUIRED_FRAGRANCE_COUNT} fragrances`;
  } else if (unique.size !== filled.length) {
    errors.fragrances = "Each fragrance must be unique";
  }

  const qty = Number(values.quantity);
  if (!Number.isFinite(qty) || qty < MIN_QUANTITY) {
    errors.quantity = `Quantity must be at least ${MIN_QUANTITY}`;
  } else if (qty > MAX_QUANTITY) {
    errors.quantity = `Quantity cannot exceed ${MAX_QUANTITY}`;
  } else if (!Number.isInteger(qty)) {
    errors.quantity = "Quantity must be a whole number";
  }

  if (
    typeof values.inscription === "string" &&
    values.inscription.length > MAX_INSCRIPTION_LENGTH
  ) {
    errors.inscription = `Keep inscription under ${MAX_INSCRIPTION_LENGTH} characters`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function defaultOrderValues() {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    fragrances: ["", "", ""],
    quantity: 1,
    inscription: "",
  };
}
