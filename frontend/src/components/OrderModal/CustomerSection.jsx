import React from "react";
import { Heading, Text, TextField, TextArea } from "@vibe/core";
import styles from "./OrderModal.module.scss";

function asValidation(message) {
  return message ? { status: "error", text: message } : undefined;
}

export default function CustomerSection({ values, errors, onChange }) {
  const setText = (key) => (value) => onChange(key, value);

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <span className={styles.stepBadge} aria-hidden="true">
          1
        </span>
        <div className={styles.sectionTitle}>
          <Heading type="h3" weight="bold">
            Customer information
          </Heading>
        </div>
        <Text
          type="text2"
          color="secondary"
          className={styles.sectionDescription}
        >
          Where are we shipping this gift box?
        </Text>
      </header>

      <div className={styles.fieldGrid}>
        <TextField
          title="First name"
          required
          requiredAsterisk
          placeholder="Jane"
          value={values.firstName}
          onChange={setText("firstName")}
          validation={asValidation(errors.firstName)}
        />
        <TextField
          title="Last name"
          required
          requiredAsterisk
          placeholder="Doe"
          value={values.lastName}
          onChange={setText("lastName")}
          validation={asValidation(errors.lastName)}
        />
      </div>

      <div className={styles.fieldGrid}>
        <TextField
          title="Email"
          required
          requiredAsterisk
          placeholder="jane@example.com"
          type="email"
          value={values.email}
          onChange={setText("email")}
          validation={asValidation(errors.email)}
        />
        <TextField
          title="Phone"
          required
          requiredAsterisk
          placeholder="+1 555 123 4567"
          type="tel"
          value={values.phone}
          onChange={setText("phone")}
          validation={asValidation(errors.phone)}
        />
      </div>

      <TextArea
        label="Shipping address"
        required
        rows={3}
        placeholder="Street, City, State, Postal code"
        value={values.address}
        onChange={(e) => onChange("address", e.target.value)}
        error={!!errors.address}
        helpText={errors.address || undefined}
      />
    </section>
  );
}
