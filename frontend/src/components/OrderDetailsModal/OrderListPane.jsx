import React from "react";
import { Heading, Text, Button, Loader, AttentionBox } from "@vibe/core";
import { DropdownChevronRight } from "@vibe/icons";
import { formatPhone, formatDate } from "../../lib/formatters";
import styles from "./OrderDetailsModal.module.scss";

export default function OrderListPane({
  order,
  accent,
  customerName,
  enrichedFragrances,
  loadingCatalog,
  usedFallback,
  onOpenRecipe,
  onClose,
  onOpenInMonday,
}) {
  return (
    <div className={styles.body}>
      <div className={styles.statusRow}>
        <span className={styles.statusPill} style={{ "--accent": accent }}>
          {order.statusLabel}
        </span>
        {order.quantity != null && (
          <Text type="text2" color="secondary">
            {order.quantity} box{order.quantity === 1 ? "" : "es"}
          </Text>
        )}
        <Text type="text2" color="secondary" className={styles.timestamp}>
          · Created {formatDate(order.createdAt)}
        </Text>
      </div>

      <section className={styles.section}>
        <span className={styles.sectionLabel}>Customer</span>
        <div className={styles.metaGrid}>
          <MetaCell label="Name" value={customerName} />
          <MetaCell label="Email" value={order.email || "—"} />
          <MetaCell
            label="Phone"
            value={order.phone ? formatPhone(order.phone) : "—"}
          />
          <MetaCell label="Shipping address" value={order.address || "—"} />
        </div>
      </section>

      <section className={styles.section}>
        <span className={styles.sectionLabel}>
          Candle ingredients ({enrichedFragrances.length})
        </span>
        {loadingCatalog && <Loader size="small" />}
        {usedFallback && !loadingCatalog && (
          <AttentionBox
            compact
            type="primary"
            text="Showing built-in catalog (fragrance API unreachable)."
          />
        )}
        {!loadingCatalog && enrichedFragrances.length === 0 && (
          <Text color="secondary">No fragrances on this order.</Text>
        )}
        <div className={styles.fragranceList}>
          {enrichedFragrances.map(({ label, meta }, idx) => (
            <FragranceRow
              key={`${label}-${idx}`}
              label={label}
              meta={meta}
              onClick={() => meta && onOpenRecipe(idx)}
            />
          ))}
        </div>
      </section>

      {order.inscription && (
        <section className={styles.section}>
          <span className={styles.sectionLabel}>Gift inscription</span>
          <div className={styles.inscription}>{order.inscription}</div>
        </section>
      )}

      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <Button kind="tertiary" onClick={onClose}>
            Close
          </Button>
        </div>
        <Button kind="primary" onClick={onOpenInMonday}>
          Open in Monday
        </Button>
      </div>
    </div>
  );
}

function MetaCell({ label, value }) {
  return (
    <div className={styles.metaCell}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaValue}>{value}</span>
    </div>
  );
}

function FragranceRow({ label, meta, onClick }) {
  const hasMeta = Boolean(meta);
  return (
    <button
      type="button"
      className={styles.fragranceCard}
      onClick={onClick}
      disabled={!hasMeta}
      aria-label={
        hasMeta ? `View ${label} recipe` : `${label} has no recipe on file`
      }
    >
      <div
        className={styles.fragranceImage}
        style={
          meta?.image_url
            ? { backgroundImage: `url(${meta.image_url})` }
            : undefined
        }
        aria-hidden
      />
      <div className={styles.fragranceBody}>
        <div className={styles.fragranceTopRow}>
          <Heading type="h3" weight="bold">
            {label}
          </Heading>
          {meta?.category && (
            <span className={styles.fragranceCategory}>{meta.category}</span>
          )}
        </div>
        {meta?.description ? (
          <Text type="text2" color="secondary" className={styles.fragranceDesc}>
            {meta.description}
          </Text>
        ) : (
          <Text
            type="text2"
            color="secondary"
            className={styles.fragranceMissing}
          >
            No scent profile on file. Add one in the Fragrance API.
          </Text>
        )}
      </div>
      {hasMeta && (
        <span className={styles.cardChevron} aria-hidden>
          <DropdownChevronRight />
        </span>
      )}
    </button>
  );
}
