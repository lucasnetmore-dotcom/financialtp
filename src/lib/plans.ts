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
      "Insights financeiros básicos",
      "Modo claro e escuro",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "€9,90",
    period: "por mês",
    tagline: "Finanças, clientes e agenda num único sistema.",
    monthlyEntryLimit: null,
    highlight: true,
    features: [
      "Lançamentos ilimitados",
      "CRM + agenda profissional",
      "Clientes, serviços e histórico integrados",
      "Relatórios e previsões avançadas",
      "Notificações e insights inteligentes",
      "Exportação PDF e Excel",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "€19,90",
    period: "por mês",
    tagline: "Para equipas e negócios que precisam de mais controlo.",
    monthlyEntryLimit: null,
    features: [
      "Tudo o que está no Pro",
      "Gestão preparada para equipa e comissões",
      "Central avançada de gestão do negócio",
      "Prioridade no suporte por e-mail",
    ],
  },
];

export const getPlanDef = (plan: PlanId): PlanDef =>
  PLANS.find((p) => p.id === plan) ?? PLANS[0]!;

export function getPlanAccess(
  profile: Profile | null | undefined,
  entries: Entry[],
  planOverride?: PlanId | null,
) {
  const plan: PlanId =
    planOverride ?? (profile?.plan as PlanId | undefined) ?? "free";
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
