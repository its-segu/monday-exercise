import React, { useCallback, useEffect, useState } from "react";
import { Button, Loader, IconButton } from "@vibe/core";
import { Delete } from "@vibe/icons";
import { fragrancesApi } from "../../api/fragrancesApi";
import AddFragranceModal from "./AddFragranceModal";
import styles from "./InventoryView.module.scss";

export default function InventoryView({ modalOpen, setModalOpen }) {
  const [fragrances, setFragrances] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fragrancesApi.list();
      setFragrances(Array.isArray(data) ? data : []);
    } catch {
      setFragrances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDelete = useCallback(
    async (id) => {
      try {
        await fragrancesApi.remove(id);
        setFragrances((prev) => prev.filter((f) => f.id !== id));
      } catch {
        /* silent */
      }
    },
    [],
  );

  const handleCreated = useCallback((newFragrance) => {
    setFragrances((prev) => [...prev, newFragrance]);
    setModalOpen(false);
  }, [setModalOpen]);

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.loadingWrap}>
          <Loader size="medium" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {fragrances.length === 0 ? (
        <div className={styles.emptyState}>
          <Button size="small" kind="secondary" onClick={() => setModalOpen(true)}>
            Add your first fragrance
          </Button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Description</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {fragrances.map((f) => (
                <tr key={f.id}>
                  <td>
                    <div className={styles.nameCell}>
                      {f.image_url ? (
                        <img
                          className={styles.thumb}
                          src={f.image_url}
                          alt={f.name}
                        />
                      ) : (
                        <div className={styles.thumbPlaceholder} />
                      )}
                      <span>{f.name}</span>
                    </div>
                  </td>
                  <td>
                    {f.category && (
                      <span className={styles.categoryBadge}>{f.category}</span>
                    )}
                  </td>
                  <td>{f.description}</td>
                  <td>
                    <div className={styles.actions}>
                      <IconButton
                        icon={Delete}
                        size="xs"
                        kind="tertiary"
                        ariaLabel={`Delete ${f.name}`}
                        onClick={() => handleDelete(f.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddFragranceModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
