import React, { useCallback, useMemo, useState } from "react";
import { Button, Flex, AttentionBox } from "@vibe/core";
import { defaultOrderValues, validateOrder } from "../../lib/validators";
import { createOrderItem } from "../../api/boardQueries";
import { FRAGRANCES_BY_ID, FRAGRANCES } from "../../data/fragrances";
import { fragrancesApi } from "../../api/fragrancesApi";
import CustomerSection from "./CustomerSection";
import FragranceSection from "./FragranceSection";
import DetailsSection from "./DetailsSection";
import styles from "./OrderModal.module.scss";

async function resolveFragranceName(id) {
  if (!id) return null;
  if (FRAGRANCES_BY_ID[id]) return FRAGRANCES_BY_ID[id].name;
  try {
    const f = await fragrancesApi.get(id);
    return f?.name || null;
  } catch {
    return FRAGRANCES.find((f) => f.id === id)?.name || null;
  }
}

async function resolveFragranceNames(ids) {
  const names = await Promise.all(ids.map(resolveFragranceName));
  return names.filter(Boolean);
}

export default function OrderForm({ boardId, onCancel, onCreated }) {
  const [values, setValues] = useState(defaultOrderValues);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleChange = useCallback((key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validation = useMemo(() => validateOrder(values), [values]);

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    if (!boardId) {
      setSubmitError(
        "Board context not loaded yet. Open this view from the Production Orders board.",
      );
      return;
    }
    const result = validateOrder(values);
    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const fragranceNames = await resolveFragranceNames(values.fragrances);
      const created = await createOrderItem(boardId, values, fragranceNames);
      onCreated?.(created);
    } catch (err) {
      if (err?.partial && err?.itemId) {
        onCreated?.(
          { id: err.itemId },
          {
            warning: `Order created (#${err.itemId}) but ${err.failures.length} field(s) couldn't be saved. Open the item in Monday to edit.`,
          },
        );
      } else {
        setSubmitError(err.message || "Could not create order");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.modalBody} onSubmit={handleSubmit} noValidate>
      <CustomerSection
        values={values}
        errors={errors}
        onChange={handleChange}
      />
      <FragranceSection
        values={values}
        errors={errors}
        onChange={handleChange}
      />
      <DetailsSection values={values} errors={errors} onChange={handleChange} />

      {submitError && (
        <div className={styles.submitError}>
          <AttentionBox
            type="danger"
            title="Could not create order"
            text={submitError}
          />
        </div>
      )}

      <Flex gap="small" justify="end" align="center" className={styles.footer}>
        <Button kind="tertiary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          kind="primary"
          type="submit"
          loading={submitting}
          disabled={submitting || !validation.isValid}
        >
          Create order
        </Button>
      </Flex>
    </form>
  );
}
