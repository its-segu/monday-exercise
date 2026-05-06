import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, ModalContent } from "@vibe/core";
import { fragrancesApi } from "../../api/fragrancesApi";
import { FRAGRANCES as BUNDLED_FRAGRANCES } from "../../data/fragrances";
import { STATUS_COLORS, STATUS_COLOR_FALLBACK } from "../../api/boardConstants";
import monday from "../../lib/monday";
import OrderListPane from "./OrderListPane";
import RecipePane, { parseRecipe } from "./RecipePane";
import styles from "./OrderDetailsModal.module.scss";

export default function OrderDetailsModal({ show, order, onClose }) {
  const [catalog, setCatalog] = useState(BUNDLED_FRAGRANCES);
  const [usedFallback, setUsedFallback] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [recipeIndex, setRecipeIndex] = useState(null);
  const slideContainerRef = useRef(null);

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

  useEffect(() => {
    const el = slideContainerRef.current?.closest('[role="dialog"]');
    if (el) {
      const scrollable = el.querySelector('[class*="modalContent"], [class*="ModalContent"]') || el;
      scrollable.scrollTop = 0;
    }
  }, [recipeIndex]);

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
        <div ref={slideContainerRef} className={styles.slideContainer}>
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
