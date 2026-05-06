import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Modal,
  ModalContent,
  TextField,
  TextArea,
  Button,
  Dropdown,
} from "@vibe/core";
import { fragrancesApi } from "../../api/fragrancesApi";
import styles from "./AddFragranceModal.module.scss";

const CATEGORY_OPTIONS = [
  { value: "Woody", label: "Woody" },
  { value: "Herbal", label: "Herbal" },
  { value: "Citrus", label: "Citrus" },
  { value: "Fresh", label: "Fresh" },
  { value: "Fruity", label: "Fruity" },
  { value: "Sweet", label: "Sweet" },
  { value: "Floral", label: "Floral" },
  { value: "Spicy", label: "Spicy" },
];

const DESCRIPTION_PLACEHOLDER =
  "Top: ingredient, ingredient. Heart: ingredient, ingredient. Base: ingredient, ingredient.";

const INITIAL_STATE = { name: "", description: "", category: "", image_url: "" };

const TIER_PATTERNS = ["Top", "Heart", "Base"].map(
  (t) => ({ tier: t, re: new RegExp(`${t}\\s*[:\\-]\\s*[^.]+\\.`, "i") }),
);

function validateDescription(desc) {
  if (!desc.trim()) return "Description is required.";
  const missing = TIER_PATTERNS
    .filter(({ re }) => !re.test(desc))
    .map(({ tier }) => tier);
  if (missing.length > 0) {
    return `Missing ${missing.join(", ")} notes. Use the format: Top: ... Heart: ... Base: ...`;
  }
  return null;
}

export default function AddFragranceModal({ show, onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef(form);
  formRef.current = form;

  const handleChange = useCallback((field) => (val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
    setError("");
  }, []);

  const handleDescriptionChange = useCallback((e) => {
    setForm((prev) => ({ ...prev, description: e.target.value }));
    setError("");
  }, []);

  const handleCategoryChange = useCallback((option) => {
    setForm((prev) => ({ ...prev, category: option?.value || "" }));
    setError("");
  }, []);

  const handleSubmit = useCallback(async () => {
    const current = formRef.current;
    const name = current.name.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    const descError = validateDescription(current.description);
    if (descError) {
      setError(descError);
      return;
    }
    setSubmitting(true);
    try {
      const created = await fragrancesApi.create({
        name,
        description: current.description.trim(),
        category: current.category,
        image_url: current.image_url.trim(),
      });
      setForm(INITIAL_STATE);
      onCreated(created);
    } catch (err) {
      setError(err?.message || "Failed to create fragrance.");
    } finally {
      setSubmitting(false);
    }
  }, [onCreated]);

  const handleClose = useCallback(() => {
    setForm(INITIAL_STATE);
    setError("");
    onClose();
  }, [onClose]);

  const categoryValue = useMemo(
    () => CATEGORY_OPTIONS.find((o) => o.value === form.category) || null,
    [form.category],
  );

  return (
    <Modal
      id="add-fragrance-modal"
      show={show}
      onClose={handleClose}
      title="Add fragrance"
      description="Add a new fragrance to your inventory."
      closeButtonAriaLabel="Close"
      width="480px"
      contentSpacing
    >
      <ModalContent>
        <div className={styles.fieldStack}>
          <TextField
            title="Name"
            placeholder="e.g. Lavender Fields"
            value={form.name}
            onChange={handleChange("name")}
            size="medium"
            requiredAsterisk
          />
          <TextArea
            label="Recipe description"
            placeholder={DESCRIPTION_PLACEHOLDER}
            value={form.description}
            onChange={handleDescriptionChange}
            rows={4}
            helpText="Format: Top: notes. Heart: notes. Base: notes."
          />
          <Dropdown
            title="Category"
            placeholder="Select a category"
            options={CATEGORY_OPTIONS}
            value={categoryValue}
            onChange={handleCategoryChange}
            clearable
            size="medium"
          />
          <TextField
            title="Image URL"
            placeholder="https://..."
            value={form.image_url}
            onChange={handleChange("image_url")}
            size="medium"
          />
          {error && <span className={styles.error}>{error}</span>}
          <div className={styles.footer}>
            <Button size="medium" kind="tertiary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              size="medium"
              kind="primary"
              onClick={handleSubmit}
              loading={submitting}
            >
              Add fragrance
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
