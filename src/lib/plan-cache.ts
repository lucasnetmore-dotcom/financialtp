import type { PlanId } from "@/lib/plans";

const KEY = "ffa-stripe-plan-v1";

export interface CachedPlan {
  userId: string;
  plan: PlanId;
  updatedAt: number;
}

export function readCachedPlan(userId: string | null | undefined): PlanId | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPlan;
    if (parsed.userId !== userId) return null;
    if (parsed.plan !== "free" && parsed.plan !== "pro" && parsed.plan !== "business") return null;
    // válido por 7 dias (renova-se ao abrir /planos)
    if (Date.now() - parsed.updatedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return parsed.plan;
  } catch {
    return null;
  }
}

export function writeCachedPlan(userId: string, plan: PlanId) {
  if (typeof window === "undefined") return;
  const payload: CachedPlan = { userId, plan, updatedAt: Date.now() };
  window.localStorage.setItem(KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("ffa-plan-changed", { detail: payload }));
}

export function clearCachedPlan() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
