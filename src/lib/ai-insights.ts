/**
 * Finance Flow AI — insights e dicas calculados a partir dos dados reais do utilizador.
 * Análise local (sem enviar dados a APIs externas): margem, ritmo da meta, categorias, projeção.
 */
import { monthISO, money, todayISO, totals, type Entry, type Settings } from "@/lib/finance";

export type InsightTone = "positive" | "neutral" | "caution" | "critical";

export interface FinanceInsight {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
  /** dica curta para ação */
  tip?: string;
}

function daysInMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Gera insights de IA financeira a partir dos lançamentos. */
export function buildFinanceInsights(
  entries: Entry[],
  settings: Settings | null,
): FinanceInsight[] {
  const currency = settings?.currency ?? "EUR";
  const insights: FinanceInsight[] = [];
  const month = monthISO();
  const today = todayISO();
  const now = new Date();
  const day = now.getDate();
  const totalDays = daysInMonth(now);
  const monthEntries = entries.filter((e) => e.entry_date.slice(0, 7) === month);
  const t = totals(monthEntries);
  const goal = Number(settings?.monthly_goal ?? 0);

  if (entries.length === 0) {
    return [
      {
        id: "welcome",
        tone: "neutral",
        title: "Comece a registar movimentos",
        body: "Assim que tiver entradas e saídas, a IA analisa margem, categorias e ritmo da meta.",
        tip: "Adicione o primeiro lançamento no botão Novo lançamento.",
      },
    ];
  }

  // Margem líquida do mês
  if (t.income > 0) {
    const margin = (t.balance / t.income) * 100;
    if (margin >= 30) {
      insights.push({
        id: `margin-good-${month}`,
        tone: "positive",
        title: "Margem saudável este mês",
        body: `A margem líquida está em ${Math.round(margin)}% (${money(t.balance, currency)} de lucro potencial sobre ${money(t.income, currency)} de entradas).`,
        tip: "Mantenha este ritmo e reserve uma parte para fundo de emergência.",
      });
    } else if (margin >= 10) {
      insights.push({
        id: `margin-ok-${month}`,
        tone: "neutral",
        title: "Margem moderada",
        body: `Margem de ${Math.round(margin)}%. Há espaço para cortar custos sem afetar as entradas.`,
        tip: "Revise as 2 categorias de maior despesa no relatório.",
      });
    } else if (margin < 0) {
      insights.push({
        id: `margin-neg-${month}`,
        tone: "critical",
        title: "Mês no vermelho",
        body: `As saídas superam as entradas em ${money(Math.abs(t.balance), currency)}.`,
        tip: "Pause gastos não essenciais até o saldo mensal voltar positivo.",
      });
    } else {
      insights.push({
        id: `margin-low-${month}`,
        tone: "caution",
        title: "Margem apertada",
        body: `Só ${Math.round(margin)}% de margem este mês. Qualquer imprevisto pode pressionar o caixa.`,
        tip: "Defina um teto semanal de saídas até recuperar folga.",
      });
    }
  }

  // Ritmo da meta
  if (goal > 0) {
    const pct = (t.income / goal) * 100;
    const expectedPct = (day / totalDays) * 100;
    const projected = day > 0 ? (t.income / day) * totalDays : 0;
    if (pct >= 100) {
      insights.push({
        id: `goal-done-${month}`,
        tone: "positive",
        title: "Meta de entradas atingida",
        body: `Já superou a meta de ${money(goal, currency)} (${Math.round(pct)}%).`,
        tip: "Considere subir a meta do próximo mês em 10–15%.",
      });
    } else if (projected >= goal) {
      insights.push({
        id: `goal-ontrack-${month}`,
        tone: "positive",
        title: "No caminho da meta",
        body: `Ao ritmo atual, projeta-se cerca de ${money(projected, currency)} no fim do mês (meta ${money(goal, currency)}).`,
        tip: "Mantenha a cadência de registos diários para não perder o ritmo.",
      });
    } else if (expectedPct - pct > 15) {
      insights.push({
        id: `goal-behind-${month}`,
        tone: "caution",
        title: "Abaixo do ritmo da meta",
        body: `Está em ${Math.round(pct)}% da meta; o calendário já vai em ~${Math.round(expectedPct)}% do mês. Faltam ${money(Math.max(0, goal - t.income), currency)}.`,
        tip: "Priorize cobranças em aberto e evite novos gastos variáveis.",
      });
    }
  }

  // Top categoria de despesa
  const byCat = new Map<string, number>();
  for (const e of monthEntries) {
    if (e.type !== "expense") continue;
    const c = e.category || "Geral";
    byCat.set(c, (byCat.get(c) ?? 0) + Number(e.value));
  }
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && t.expense > 0) {
    const share = (top[1] / t.expense) * 100;
    if (share >= 35) {
      insights.push({
        id: `cat-conc-${month}`,
        tone: "caution",
        title: `Concentração em "${top[0]}"`,
        body: `${Math.round(share)}% das saídas do mês (${money(top[1], currency)}) estão nesta categoria.`,
        tip: "Divida ou renegocie fornecedores nesta área para reduzir risco.",
      });
    }
  }

  // Comparação com últimos 7 dias vs anteriores
  const last7 = totals(entries.filter((e) => e.entry_date >= addDays(today, -7)));
  const prev7 = totals(
    entries.filter(
      (e) => e.entry_date >= addDays(today, -14) && e.entry_date < addDays(today, -7),
    ),
  );
  if (prev7.expense > 0 && last7.expense > prev7.expense * 1.25) {
    insights.push({
      id: `spend-up-${today}`,
      tone: "caution",
      title: "Saídas em alta na última semana",
      body: `Gastou ${money(last7.expense, currency)} nos últimos 7 dias vs ${money(prev7.expense, currency)} na semana anterior.`,
      tip: "Revise lançamentos recentes e marque o que era extraordinário.",
    });
  } else if (prev7.income > 0 && last7.income > prev7.income * 1.2) {
    insights.push({
      id: `income-up-${today}`,
      tone: "positive",
      title: "Entradas a acelerar",
      body: `Entradas da última semana (${money(last7.income, currency)}) estão acima da semana anterior.`,
      tip: "Aproveite para reforçar a meta ou o fundo de reserva.",
    });
  }

  // Dica de hábito
  const lastDate = entries.reduce((m, e) => (e.entry_date > m ? e.entry_date : m), "");
  if (lastDate) {
    const gap = Math.round(
      (new Date(`${today}T00:00`).getTime() - new Date(`${lastDate}T00:00`).getTime()) / 86400000,
    );
    if (gap >= 2) {
      insights.push({
        id: `habit-${today}`,
        tone: "neutral",
        title: "Registo em atraso",
        body: `Passaram ${gap} dias sem novos lançamentos. A IA precisa de dados frescos para projeções precisas.`,
        tip: "Reserve 2 minutos no fim do dia para registar movimentos.",
      });
    }
  }

  return insights.slice(0, 5);
}
