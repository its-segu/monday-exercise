import React, { useEffect, useMemo, useState } from "react";
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
import monday from "../../lib/monday";
import styles from "./OrderDetailsModal.module.scss";

/**
 * Parses a recipe-formatted description ("Top: x, y. Heart: a, b. Base: c, d.")
 * into structured sections so the producer-facing recipe view can lay each
 * tier out cleanly. Falls back to a single "Notes" block when the description
 * isn't structured (e.g. user-created entries via POST /fragrances).
 */
function parseRecipe(description) {
  if (!description) return null;
  const keys = ["Top", "Heart", "Base"];
  const sections = keys
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

/**
 * Perfumer-school microcopy. The pane reads like a real fragrance recipe
 * card — each tier explains *why* it's there, not just what's in it. This
 * gives the production team enough context to QA the pour without needing
 * a separate doc.
 */
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

const STATUS_COLORS = {
  "New Order": "#579bfc",
  "Working on it": "#fdab3d",
  Done: "#00c875",
  Stuck: "#df2f4a",
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

  if (!order) return null;

  const accent = STATUS_COLORS[order.statusLabel] || "#c4c4c4";
  const customerName =
    [order.firstName, order.lastName].filter(Boolean).join(" ") || "—";

  const handleOpenInMonday = () => {
    monday.execute("openItemCard", { itemId: order.id });
    onClose?.();
  };

  const showingRecipe = recipeIndex != null;
  const recipeFragrance =
    showingRecipe && enrichedFragrances[recipeIndex]
      ? enrichedFragrances[recipeIndex]
      : null;
  const recipeMeta = recipeFragrance?.meta || null;
  const recipeSections = recipeMeta
    ? parseRecipe(recipeMeta.description)
    : null;

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
            {/* ----- LIST PANE: order details + candle list ----- */}
            <div className={styles.pane} aria-hidden={showingRecipe}>
              <div className={styles.body}>
                <div className={styles.statusRow}>
                  <span
                    className={styles.statusPill}
                    style={{ "--accent": accent }}
                  >
                    {order.statusLabel}
                  </span>
                  {order.quantity != null && (
                    <Text type="text2" color="secondary">
                      {order.quantity} box{order.quantity === 1 ? "" : "es"}
                    </Text>
                  )}
                  <Text
                    type="text2"
                    color="secondary"
                    className={styles.timestamp}
                  >
                    · Created {formatDate(order.createdAt)}
                  </Text>
                </div>

                <section className={styles.section}>
                  <span className={styles.sectionLabel}>Customer</span>
                  <div className={styles.metaGrid}>
                    <div className={styles.metaCell}>
                      <span className={styles.metaLabel}>Name</span>
                      <span className={styles.metaValue}>{customerName}</span>
                    </div>
                    <div className={styles.metaCell}>
                      <span className={styles.metaLabel}>Email</span>
                      <span className={styles.metaValue}>
                        {order.email || "—"}
                      </span>
                    </div>
                    <div className={styles.metaCell}>
                      <span className={styles.metaLabel}>Phone</span>
                      <span className={styles.metaValue}>
                        {order.phone ? formatPhone(order.phone) : "—"}
                      </span>
                    </div>
                    <div className={styles.metaCell}>
                      <span className={styles.metaLabel}>Shipping address</span>
                      <span className={styles.metaValue}>
                        {order.address || "—"}
                      </span>
                    </div>
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
                    {enrichedFragrances.map(({ label, meta }, idx) => {
                      const hasMeta = Boolean(meta);
                      return (
                        <button
                          type="button"
                          className={styles.fragranceCard}
                          key={`${label}-${idx}`}
                          onClick={() => hasMeta && setRecipeIndex(idx)}
                          disabled={!hasMeta}
                          aria-label={
                            hasMeta
                              ? `View ${label} recipe`
                              : `${label} has no recipe on file`
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
                                <span className={styles.fragranceCategory}>
                                  {meta.category}
                                </span>
                              )}
                            </div>
                            {meta?.description ? (
                              <Text
                                type="text2"
                                color="secondary"
                                className={styles.fragranceDesc}
                              >
                                {meta.description}
                              </Text>
                            ) : (
                              <Text
                                type="text2"
                                color="secondary"
                                className={styles.fragranceMissing}
                              >
                                No scent profile on file. Add one in the
                                Fragrance API.
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
                    })}
                  </div>
                </section>

                {order.inscription && (
                  <section className={styles.section}>
                    <span className={styles.sectionLabel}>
                      Gift inscription
                    </span>
                    <div className={styles.inscription}>
                      {order.inscription}
                    </div>
                  </section>
                )}

                <div className={styles.footer}>
                  <div className={styles.footerLeft}>
                    <Button kind="tertiary" onClick={onClose}>
                      Close
                    </Button>
                  </div>
                  <Button kind="primary" onClick={handleOpenInMonday}>
                    Open in Monday
                  </Button>
                </div>
              </div>
            </div>

            {/* ----- RECIPE PANE: focused producer recipe view ----- */}
            <div className={styles.pane} aria-hidden={!showingRecipe}>
              {recipeMeta &&
                (() => {
                  const totalNotes =
                    recipeSections?.reduce(
                      (acc, s) => acc + s.ingredients.length,
                      0,
                    ) || 0;
                  return (
                    <div className={styles.recipeBody}>
                      <button
                        type="button"
                        className={styles.backButton}
                        onClick={() => setRecipeIndex(null)}
                        aria-label="Back to order"
                      >
                        <span className={styles.backChevron} aria-hidden>
                          <DropdownChevronLeft />
                        </span>
                        <span>Back to order</span>
                      </button>

                      {/* HEADER: image + title block */}
                      <header className={styles.recipeCardHeader}>
                        <div
                          className={styles.recipeThumb}
                          style={
                            recipeMeta.image_url
                              ? {
                                  backgroundImage: `url(${recipeMeta.image_url})`,
                                }
                              : undefined
                          }
                          aria-hidden
                        />
                        <div className={styles.recipeTitleBlock}>
                          <span className={styles.recipeKicker}>
                            Candle recipe
                          </span>
                          <Heading
                            type="h2"
                            weight="bold"
                            className={styles.recipeTitle}
                          >
                            {recipeMeta.name}
                          </Heading>
                          <div className={styles.recipeTitleMeta}>
                            {recipeMeta.category && (
                              <span className={styles.fragranceCategory}>
                                {recipeMeta.category}
                              </span>
                            )}
                            {recipeSections && (
                              <span className={styles.recipeMetaText}>
                                {totalNotes} note
                                {totalNotes === 1 ? "" : "s"} ·{" "}
                                {recipeSections.length} tier
                                {recipeSections.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                        </div>
                      </header>

                      {/* INGREDIENTS: cookbook-style tier cards */}
                      {recipeSections ? (
                        <section className={styles.tiers}>
                          <span className={styles.sectionLabel}>
                            Ingredients
                          </span>
                          {recipeSections.map(({ key, ingredients }, idx) => {
                            const tier = key.toLowerCase();
                            const info = TIER_INFO[tier] || {
                              label: `${key} notes`,
                              blurb: "",
                            };
                            return (
                              <article
                                key={tier}
                                className={`${styles.tier} ${
                                  styles[`tier_${tier}`] || ""
                                }`}
                              >
                                <header className={styles.tierHeader}>
                                  <span className={styles.tierStep}>
                                    {idx + 1}
                                  </span>
                                  <div className={styles.tierTitleBlock}>
                                    <h4 className={styles.tierTitle}>
                                      {info.label}
                                    </h4>
                                    {info.blurb && (
                                      <p className={styles.tierBlurb}>
                                        {info.blurb}
                                      </p>
                                    )}
                                  </div>
                                  <span className={styles.tierCount}>
                                    {ingredients.length}
                                  </span>
                                </header>
                                <ul className={styles.tierList}>
                                  {ingredients.map((ing) => (
                                    <li
                                      key={`${tier}-${ing}`}
                                      className={styles.tierItem}
                                    >
                                      <span
                                        className={styles.tierBullet}
                                        aria-hidden
                                      />
                                      <span className={styles.tierItemText}>
                                        {ing}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </article>
                            );
                          })}
                        </section>
                      ) : (
                        <section className={styles.section}>
                          <span className={styles.sectionLabel}>
                            Producer notes
                          </span>
                          <Text type="text2" color="secondary">
                            {recipeMeta.description}
                          </Text>
                        </section>
                      )}

                      <div className={styles.recipeFooter}>
                        <span className={styles.metaLabel}>Fragrance ID</span>
                        <code className={styles.metaCode}>{recipeMeta.id}</code>
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
