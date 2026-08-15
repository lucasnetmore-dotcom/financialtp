import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { getEffectivePlan } from "@/lib/billing.functions";
import { readCachedPlan, writeCachedPlan } from "@/lib/plan-cache";
import type { PlanId } from "@/lib/plans";

/**
 * Plano efetivo: cache local + Stripe (não depende do RLS da tabela profiles).
 */
export function useEffectivePlan(userId: string | null) {
  const fetchPlan = useServerFn(getEffectivePlan);
  const [plan, setPlan] = useState<PlanId | null>(() => readCachedPlan(userId));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPlan(readCachedPlan(userId));
  }, [userId]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { userId?: string; plan?: PlanId } | undefined;
      if (detail?.userId && detail.userId === userId && detail.plan) {
        setPlan(detail.plan);
      } else if (userId) {
        setPlan(readCachedPlan(userId));
      }
    };
    window.addEventListener("ffa-plan-changed", onChange);
    return () => window.removeEventListener("ffa-plan-changed", onChange);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return null;
    setLoading(true);
    try {
      const result = await fetchPlan();
      const next = result.plan as PlanId;
      writeCachedPlan(userId, next);
      setPlan(next);
      return next;
    } catch {
      return readCachedPlan(userId);
    } finally {
      setLoading(false);
    }
  }, [fetchPlan, userId]);

  useEffect(() => {
    if (!userId) return;
    void refresh();
  }, [userId, refresh]);

  return { plan, loading, refresh, setPlanLocal: (p: PlanId) => {
    if (!userId) return;
    writeCachedPlan(userId, p);
    setPlan(p);
  } };
}
