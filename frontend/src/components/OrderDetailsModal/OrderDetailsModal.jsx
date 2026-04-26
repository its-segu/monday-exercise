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
import { fragrancesApi } from "../../api/fragrancesApi";
import { FRAGRANCES as BUNDLED_FRAGRANCES } from "../../data/fragrances";
import monday from "../../lib/monday";
import styles from "./OrderDetailsModal.module.scss";

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

  useEffect(() => {
    if (!show) return;
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
            <Text type="text2" color="secondary" className={styles.timestamp}>
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
                <span className={styles.metaValue}>{order.email || "—"}</span>
              </div>
              <div className={styles.metaCell}>
                <span className={styles.metaLabel}>Phone</span>
                <span className={styles.metaValue}>
                  {order.phone ? formatPhone(order.phone) : "—"}
                </span>
              </div>
              <div className={styles.metaCell}>
                <span className={styles.metaLabel}>Shipping address</span>
                <span className={styles.metaValue}>{order.address || "—"}</span>
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
              {enrichedFragrances.map(({ label, meta }, idx) => (
                <div className={styles.fragranceCard} key={`${label}-${idx}`}>
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
                      <Text type="text2" color="secondary">
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
                </div>
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
            <Button kind="primary" onClick={handleOpenInMonday}>
              Open in Monday
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
