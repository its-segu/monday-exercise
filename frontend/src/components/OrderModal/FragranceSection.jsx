import React, { useEffect, useMemo, useState } from "react";
import { Heading, Text, Dropdown, Loader, Flex } from "@vibe/core";
import { fragrancesApi } from "../../api/fragrancesApi";
import { FRAGRANCES as FALLBACK_FRAGRANCES } from "../../data/fragrances";
import { REQUIRED_FRAGRANCE_COUNT } from "../../lib/validators";
import styles from "./OrderModal.module.scss";

export default function FragranceSection({ values, errors, onChange }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, source } = await fragrancesApi.list();
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          setCatalog(data);
          setUsedFallback(source !== "api");
        } else {
          setCatalog(FALLBACK_FRAGRANCES);
          setUsedFallback(true);
        }
      } catch {
        if (!cancelled) {
          setCatalog(FALLBACK_FRAGRANCES);
          setUsedFallback(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () =>
      catalog.map((f) => ({
        value: f.id,
        label: f.name,
        category: f.category,
        description: f.description,
      })),
    [catalog],
  );

  const optionsById = useMemo(
    () => new Map(options.map((o) => [o.value, o])),
    [options],
  );

  // Pre-compute per-slot option lists so each Dropdown's `options` prop is
  // referentially stable across renders.
  const perSlotOptions = useMemo(() => {
    const picks = values.fragrances || [];
    return Array.from({ length: REQUIRED_FRAGRANCE_COUNT }, (_, slotIdx) => {
      const taken = new Set(picks.filter((_, i) => i !== slotIdx));
      return options.filter((opt) => !taken.has(opt.value));
    });
  }, [options, values.fragrances]);

  const handlePick = (slotIndex) => (selection) => {
    const next = [...(values.fragrances || ["", "", ""])];
    next[slotIndex] = selection ? selection.value : "";
    onChange("fragrances", next);
  };

  const valueForSlot = (slotIndex) => {
    const id = values.fragrances?.[slotIndex];
    return id ? optionsById.get(id) || null : null;
  };

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <span className={styles.stepBadge} aria-hidden="true">
          2
        </span>
        <div className={styles.sectionTitle}>
          <Heading type="h3" weight="bold">
            Fragrance selections
          </Heading>
        </div>
        <Text
          type="text2"
          color="secondary"
          className={styles.sectionDescription}
        >
          Pick {REQUIRED_FRAGRANCE_COUNT} distinct fragrances for the gift box.
        </Text>
      </header>

      {loading ? (
        <Flex align="center" justify="center" style={{ minHeight: 80 }}>
          <Loader size="small" />
        </Flex>
      ) : (
        <div className={styles.fieldStack}>
          {Array.from({ length: REQUIRED_FRAGRANCE_COUNT }).map((_, idx) => (
            <div className={styles.fragranceRow} key={idx}>
              <span className={styles.fragranceLabel}>Candle {idx + 1}</span>
              <Dropdown
                placeholder="Choose a fragrance"
                options={perSlotOptions[idx]}
                value={valueForSlot(idx)}
                onChange={handlePick(idx)}
                clearable
                searchable
                size="small"
              />
            </div>
          ))}
          {errors.fragrances && (
            <span className={styles.fragranceError}>{errors.fragrances}</span>
          )}
          {usedFallback && (
            <span className={styles.fallbackNotice}>
              Showing built-in catalog (fragrance API unreachable).
            </span>
          )}
        </div>
      )}
    </section>
  );
}
