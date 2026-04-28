import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getOrderItems, getStatusChangeHistory } from "../../api/boardQueries";
import {
  decorateOrdersWithSla,
  summarizeSla,
  SLA_TARGET_DAYS,
} from "../../lib/sla";

const HISTORY_DAYS = 90;
const AT_RISK_LIMIT = 6;

export default function useAnalyticsData(boardId, show) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [history, setHistory] = useState([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const cancelRef = useRef(false);

  const fetchData = useCallback(
    async ({ silent = false } = {}) => {
      if (!boardId) return;
      cancelRef.current = false;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [orderItems, statusHistory] = await Promise.all([
          getOrderItems(boardId),
          getStatusChangeHistory(boardId, { days: HISTORY_DAYS }).catch(
            (err) => {
              console.warn(
                "[AnalyticsModal] activity_logs unavailable:",
                err?.message,
              );
              return [];
            },
          ),
        ]);
        if (cancelRef.current) return;
        setOrders(orderItems || []);
        setHistory(statusHistory || []);
        setLastRefreshedAt(Date.now());
      } catch (err) {
        if (cancelRef.current) return;
        setError(err.message || "Could not load analytics");
      } finally {
        if (!cancelRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [boardId],
  );

  useEffect(() => {
    if (!show || !boardId) return undefined;
    fetchData();
    return () => {
      cancelRef.current = true;
    };
  }, [show, boardId, fetchData]);

  const decorated = useMemo(
    () =>
      decorateOrdersWithSla(orders, history, { targetDays: SLA_TARGET_DAYS }),
    [orders, history],
  );

  const summary = useMemo(
    () => summarizeSla(decorated, { targetDays: SLA_TARGET_DAYS }),
    [decorated],
  );

  const atRiskList = useMemo(
    () =>
      decorated
        .filter((o) => o.atRisk)
        .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0))
        .slice(0, AT_RISK_LIMIT),
    [decorated],
  );

  const refresh = useCallback(() => fetchData({ silent: true }), [fetchData]);

  return {
    loading,
    refreshing,
    error,
    summary,
    atRiskList,
    hasHistory: history.length > 0,
    lastRefreshedAt,
    refresh,
  };
}

export { HISTORY_DAYS };
