import React from "react";
import { Heading, Text } from "@vibe/core";
import { DropdownChevronLeft } from "@vibe/icons";
import styles from "./OrderDetailsModal.module.scss";

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

function splitIngredients(raw) {
  return String(raw)
    .split(/,(?![^()]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseRecipe(description) {
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

export default function RecipePane({ meta, sections, onBack }) {
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
