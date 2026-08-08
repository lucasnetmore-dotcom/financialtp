import type { Entry, Profile } from "@/lib/finance";
import { monthISO } from "@/lib/finance";

export type PlanId = "free" | "pro" | "business";

export interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  tagline: string;
  /** null = ilimitado */
  monthlyEntryLimit: number | null;
  features: string[];
  highlight?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    period: "para sempre",
    tagline: "Para começar a organizar as contas.",
    monthlyEntryLimit: 100,
    features: [
      "Até 100 lançamentos por mês",
      "Sincronização entre dispositivos",
      "Exportação CSV",
      "Modo claro e escuro",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "€—",
    period: "por mês",
    tagline: "Para quem gere o negócio a sério.",
    monthlyEntryLimit: null,
    highlight: true,
    features: [
      "Lançamentos ilimitados",
      "Relatórios avançados",
      "Exportação PDF e Excel",
      "Backup automático e restauro",
      "Notificações inteligentes",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "€—",
    period: "por mês",
    tagline: "Para equipas e vários negócios.",
    monthlyEntryLimit: null,
    features: [
      "Tudo o que está no Pro",
      "Lançamentos ilimitados",
      "Estrutura pronta para múltiplos utilizadores",
      "Apoio prioritário",
    ],
  },
];

export const getPlanDef = (plan: PlanId): PlanDef =>
  PLANS.find((p) => p.id === plan) ?? PLANS[0]!;

/** Função central: plano do utilizador + permissões e limites. */
export function getPlanAccess(profile: Profile | null | undefined, entries: Entry[]) {
  const plan: PlanId = (profile?.plan as PlanId | undefined) ?? "free";
  const def = getPlanDef(plan);
  const limit = def.monthlyEntryLimit;
  const month = monthISO();
  const usedThisMonth = entries.filter((e) => e.entry_date.slice(0, 7) === month).length;
  const remaining = limit === null ? null : Math.max(0, limit - usedThisMonth);

  return {
    plan,
    planName: def.name,
    limit,
    usedThisMonth,
    remaining,
    isPaid: plan !== "free",
    canCreateEntry: limit === null || usedThisMonth < limit,
    canUseAdvancedReports: plan !== "free",
    canUseTeam: plan === "business",
    limitMessage: `Atingiu o limite de ${limit} lançamentos deste mês no plano Free. Faça upgrade para Pro e tenha lançamentos ilimitados.`,
  };
}
