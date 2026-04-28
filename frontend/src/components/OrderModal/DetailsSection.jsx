import React from "react";
import { Heading, Text, TextField, TextArea } from "@vibe/core";
import {
  MAX_INSCRIPTION_LENGTH,
  MAX_QUANTITY,
  MIN_QUANTITY,
} from "../../lib/validators";
import styles from "./OrderModal.module.scss";

function asValidation(message) {
  return message ? { status: "error", text: message } : undefined;
}

export default function DetailsSection({ values, errors, onChange }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <span className={styles.stepBadge} aria-hidden="true">
          3
        </span>
        <div className={styles.sectionTitle}>
          <Heading type="h3" weight="bold">
            Order details
          </Heading>
        </div>
        <Text
          type="text2"
          color="secondary"
          className={styles.sectionDescription}
        >
          How many gift boxes, and any inscription on the lid?
        </Text>
      </header>

      <div className={styles.fieldGrid}>
        <TextField
          title="Quantity"
          required
          requiredAsterisk
          type="number"
          value={String(values.quantity ?? "")}
          onChange={(v) => onChange("quantity", v === "" ? "" : Number(v))}
          validation={asValidation(errors.quantity)}
          placeholder={`${MIN_QUANTITY}-${MAX_QUANTITY}`}
        />
        <div />
      </div>

      <TextArea
        label={`Inscription (optional, max ${MAX_INSCRIPTION_LENGTH} chars)`}
        rows={2}
        value={values.inscription || ""}
        onChange={(e) => onChange("inscription", e.target.value)}
        maxLength={MAX_INSCRIPTION_LENGTH}
        showCharCount
        placeholder="e.g. Happy Birthday, Sam!"
        error={!!errors.inscription}
        helpText={errors.inscription || undefined}
      />
    </section>
  );
}
