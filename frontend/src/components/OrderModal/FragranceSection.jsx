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
    [catalog]
  );

  const handlePick = (slotIndex) => (selection) => {
    const next = [...(values.fragrances || ["", "", ""])];
    next[slotIndex] = selection ? selection.value : "";
    onChange("fragrances", next);
  };

  const optionsForSlot = (slotIndex) => {
    const taken = new Set(
      (values.fragrances || []).filter((_, i) => i !== slotIndex)
    );
    return options.filter((opt) => !taken.has(opt.value));
  };

  const valueForSlot = (slotIndex) => {
    const id = values.fragrances?.[slotIndex];
    if (!id) return null;
    return options.find((o) => o.value === id) || null;
  };

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <Heading type="h3" weight="bold">
          Fragrance selections
        </Heading>
        <Text type="text2" color="secondary">
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
                options={optionsForSlot(idx)}
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
