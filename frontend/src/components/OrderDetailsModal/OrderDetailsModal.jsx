import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  ModalContent,
  Heading,
  Text,
  Button,
  Loader,
  AttentionBox,
} from "@vibe/core";
import { DropdownChevronRight, DropdownChevronLeft } from "@vibe/icons";
import { fragrancesApi } from "../../api/fragrancesApi";
import { FRAGRANCES as BUNDLED_FRAGRANCES } from "../../data/fragrances";
import { STATUS_COLORS, STATUS_COLOR_FALLBACK } from "../../api/boardConstants";
import monday from "../../lib/monday";
import styles from "./OrderDetailsModal.module.scss";

// Parses "Top: x, y. Heart: a, b. Base: c, d." into structured tier sections.
// Falls back to null when the description isn't recipe-formatted (e.g. an
// entry created via POST /fragrances without the Top/Heart/Base convention).
function parseRecipe(description) {
  if (!description) return null;
  const sections = ["Top", "Heart", "Base"]
    .map((key) => {
      const re = new RegExp(`${key}\\s*[:\\-]\\s*([^.]+)\\.`, "i");
      const match = description.match(re);
      return match ? { key, ingredients: splitIngredients(match[1]) } : null;
    })
    .filter(Boolean);
  return sections.length > 0 ? sections : null;
}

function splitIngredients(raw) {
  return String(raw)
    .split(/,(?![^()]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const TIER_INFO = {
  top: {
    label: "Top notes",
    blurb:
      "First impression — bright, volatile notes you smell within seconds of lighting.",
  },
  heart: {
    label: "Heart notes",
    blurb:
      "The body of the scent — emerges as the top fades and defines the candle's personality.",
  },
  base: {
    label: "Base notes",
    blurb:
      "The finish — deep, lingering notes that anchor the burn and carry through the room.",
  },
};

function formatPhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D+/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function OrderDetailsModal({ show, order, onClose }) {
  const [catalog, setCatalog] = useState(BUNDLED_FRAGRANCES);
  const [usedFallback, setUsedFallback] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [recipeIndex, setRecipeIndex] = useState(null);

  useEffect(() => {
    if (!show) {
      setRecipeIndex(null);
      return;
    }
    let cancelled = false;
    setLoadingCatalog(true);
    fragrancesApi
      .list()
      .then(({ data, source }) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          setCatalog(data);
          setUsedFallback(source !== "api");
        } else {
          setCatalog(BUNDLED_FRAGRANCES);
          setUsedFallback(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog(BUNDLED_FRAGRANCES);
        setUsedFallback(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, [show]);

  const enrichedFragrances = useMemo(() => {
    if (!order) return [];
    const byName = new Map(catalog.map((f) => [f.name, f]));
    return (order.fragrances || []).map((label) => ({
      label,
      meta: byName.get(label) || null,
    }));
  }, [order, catalog]);

  const showingRecipe = recipeIndex != null;
  const recipeFragrance = showingRecipe
    ? enrichedFragrances[recipeIndex] || null
    : null;
  const recipeMeta = recipeFragrance?.meta || null;
  const recipeSections = useMemo(
    () => (recipeMeta ? parseRecipe(recipeMeta.description) : null),
    [recipeMeta],
  );

  const handleOpenRecipe = useCallback((idx) => setRecipeIndex(idx), []);
  const handleCloseRecipe = useCallback(() => setRecipeIndex(null), []);

  const handleOpenInMonday = useCallback(() => {
    if (!order) return;
    monday.execute("openItemCard", { itemId: order.id });
    onClose?.();
  }, [order, onClose]);

  if (!order) return null;

  const accent = STATUS_COLORS[order.statusLabel] || STATUS_COLOR_FALLBACK;
  const customerName =
    [order.firstName, order.lastName].filter(Boolean).join(" ") || "—";

  return (
    <Modal
      id={`order-details-${order.id}`}
      show={show}
      onClose={onClose}
      title={order.name || `Order #${order.id}`}
      description={`Order #${order.id}`}
      closeButtonAriaLabel="Close"
      width="600px"
      contentSpacing
    >
      <ModalContent>
        <div className={styles.slideContainer}>
          <div
            className={`${styles.slideTrack}${showingRecipe ? ` ${styles.showRecipe}` : ""}`}
          >
            <div className={styles.pane} aria-hidden={showingRecipe}>
              <OrderListPane
                order={order}
                accent={accent}
                customerName={customerName}
                enrichedFragrances={enrichedFragrances}
                loadingCatalog={loadingCatalog}
                usedFallback={usedFallback}
                onOpenRecipe={handleOpenRecipe}
                onClose={onClose}
                onOpenInMonday={handleOpenInMonday}
              />
            </div>
            <div className={styles.pane} aria-hidden={!showingRecipe}>
              {recipeMeta && (
                <RecipePane
                  meta={recipeMeta}
                  sections={recipeSections}
                  onBack={handleCloseRecipe}
                />
              )}
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function OrderListPane({
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

function RecipePane({ meta, sections, onBack }) {
  const totalNotes =
    sections?.reduce((acc, s) => acc + s.ingredients.length, 0) || 0;

  return (
    <div className={styles.recipeBody}>
      <button
        type="button"
        className={styles.backButton}
        onClick={onBack}
        aria-label="Back to order"
      >
        <span className={styles.backChevron} aria-hidden>
          <DropdownChevronLeft />
        </span>
        <span>Back to order</span>
      </button>

      <header className={styles.recipeCardHeader}>
        <div
          className={styles.recipeThumb}
          style={
            meta.image_url
              ? { backgroundImage: `url(${meta.image_url})` }
              : undefined
          }
          aria-hidden
        />
        <div className={styles.recipeTitleBlock}>
          <span className={styles.recipeKicker}>Candle recipe</span>
          <Heading type="h2" weight="bold" className={styles.recipeTitle}>
            {meta.name}
          </Heading>
          <div className={styles.recipeTitleMeta}>
            {meta.category && (
              <span className={styles.fragranceCategory}>{meta.category}</span>
            )}
            {sections && (
              <span className={styles.recipeMetaText}>
                {totalNotes} note{totalNotes === 1 ? "" : "s"} ·{" "}
                {sections.length} tier{sections.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </header>

      {sections ? (
        <section className={styles.tiers}>
          <span className={styles.sectionLabel}>Ingredients</span>
          {sections.map(({ key, ingredients }, idx) => {
            const tier = key.toLowerCase();
            const info = TIER_INFO[tier] || {
              label: `${key} notes`,
              blurb: "",
            };
            return (
              <article
                key={tier}
                className={`${styles.tier} ${styles[`tier_${tier}`] || ""}`}
              >
                <header className={styles.tierHeader}>
                  <span className={styles.tierStep}>{idx + 1}</span>
                  <div className={styles.tierTitleBlock}>
                    <h4 className={styles.tierTitle}>{info.label}</h4>
                    {info.blurb && (
                      <p className={styles.tierBlurb}>{info.blurb}</p>
                    )}
                  </div>
                  <span className={styles.tierCount}>{ingredients.length}</span>
                </header>
                <ul className={styles.tierList}>
                  {ingredients.map((ing) => (
                    <li key={`${tier}-${ing}`} className={styles.tierItem}>
                      <span className={styles.tierBullet} aria-hidden />
                      <span className={styles.tierItemText}>{ing}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>
      ) : (
        <section className={styles.section}>
          <span className={styles.sectionLabel}>Producer notes</span>
          <Text type="text2" color="secondary">
            {meta.description}
          </Text>
        </section>
      )}

      <div className={styles.recipeFooter}>
        <span className={styles.metaLabel}>Fragrance ID</span>
        <code className={styles.metaCode}>{meta.id}</code>
      </div>
    </div>
  );
}
