/**
 * Notificações inteligentes — calculadas no dispositivo a partir dos
 * lançamentos reais do utilizador + dicas de IA financeira.
 */
import { buildFinanceInsights } from "@/lib/ai-insights";
import { monthISO, todayISO, totals, type Entry, type Settings } from "@/lib/finance";

export type AlertLevel = "info" | "success" | "warning" | "danger";

export interface SmartAlert {
  id: string;
  level: AlertLevel;
  title: string;
  body: string;
  kind: AlertKind;
}

export type AlertKind =
  | "goal"
  | "highSpend"
  | "negativeBalance"
  | "categorySpike"
  | "inactivity"
  | "weeklySummary"
  | "aiTip";

export interface NotificationPrefs {
  enabled: boolean;
  push: boolean;
  goal: boolean;
  highSpend: boolean;
  negativeBalance: boolean;
  categorySpike: boolean;
  inactivity: boolean;
  weeklySummary: boolean;
  aiTip: boolean;
  highSpendFactor: number;
  inactivityDays: number;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  push: false,
  goal: true,
  highSpend: true,
  negativeBalance: true,
  categorySpike: true,
  inactivity: true,
  weeklySummary: true,
  aiTip: true,
  highSpendFactor: 2,
  inactivityDays: 3,
};

const PREFS_KEY = "ftp-notif-prefs-v1";
const SEEN_KEY = "ftp-notif-seen-v1";
const PUSHED_KEY = "ftp-notif-pushed-v1";

export function loadPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: NotificationPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function readList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export const seenAlerts = {
  list: () => readList(SEEN_KEY),
  markAll(ids: string[]) {
    if (typeof window === "undefined") return;
    const merged = Array.from(new Set([...readList(SEEN_KEY), ...ids])).slice(-200);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(merged));
  },
};

function daysInMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const fmt = (n: number, currency: string) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(n || 0);

export function buildAlerts(
  entries: Entry[],
  settings: Settings | null,
  prefs: NotificationPrefs = DEFAULT_PREFS,
): SmartAlert[] {
  if (!prefs.enabled) return [];

  const currency = settings?.currency ?? "EUR";
  const alerts: SmartAlert[] = [];
  const month = monthISO();
  const today = todayISO();
  const now = new Date();
  const day = now.getDate();
  const totalDays = daysInMonth(now);

  if (entries.length === 0) {
    if (prefs.aiTip) {
      alerts.push({
        id: `ai-welcome-${today}`,
        kind: "aiTip",
        level: "info",
        title: "Dica Finance Flow AI",
        body: "Registe o primeiro lançamento para a IA começar a analisar margem, meta e categorias.",
      });
    }
    return alerts;
  }

  const monthEntries = entries.filter((e) => e.entry_date.slice(0, 7) === month);
  const monthTotals = totals(monthEntries);

  const goal = Number(settings?.monthly_goal ?? 0);
  if (prefs.goal && goal > 0) {
    const pct = (monthTotals.income / goal) * 100;
    if (pct >= 100) {
      alerts.push({
        id: `goal-hit-${month}`,
        kind: "goal",
        level: "success",
        title: "Meta mensal atingida",
        body: `Já entrou ${fmt(monthTotals.income, currency)} este mês — ${Math.round(pct)}% da meta de ${fmt(goal, currency)}.`,
      });
    } else if (day / totalDays > 0.6 && pct < (day / totalDays) * 100 - 15) {
      alerts.push({
        id: `goal-risk-${month}`,
        kind: "goal",
        level: "warning",
        title: "Meta mensal em risco",
        body: `Está em ${Math.round(pct)}% da meta com ${totalDays - day} dias por fechar. Faltam ${fmt(goal - monthTotals.income, currency)}.`,
      });
    }
  }

  if (prefs.negativeBalance && monthTotals.balance < 0) {
    alerts.push({
      id: `negative-${month}`,
      kind: "negativeBalance",
      level: "danger",
      title: "Saldo do mês negativo",
      body: `As saídas superam as entradas em ${fmt(Math.abs(monthTotals.balance), currency)} este mês.`,
    });
  }

  if (prefs.highSpend) {
    const from = addDays(today, -30);
    const window30 = entries.filter(
      (e) => e.type === "expense" && e.entry_date >= from && e.entry_date < today,
    );
    const avgDay = window30.reduce((s, e) => s + Number(e.value), 0) / 30;
    const todayExpense = totals(entries.filter((e) => e.entry_date === today)).expense;
    if (avgDay > 0 && todayExpense > avgDay * prefs.highSpendFactor) {
      alerts.push({
        id: `high-spend-${today}`,
        kind: "highSpend",
        level: "warning",
        title: "Gasto elevado hoje",
        body: `Já saíram ${fmt(todayExpense, currency)} hoje — bem acima da média diária de ${fmt(avgDay, currency)}.`,
      });
    }
  }

  if (prefs.categorySpike) {
    const byCat = new Map<string, number>();
    for (const e of monthEntries) {
      if (e.type !== "expense") continue;
      byCat.set(e.category || "Geral", (byCat.get(e.category || "Geral") ?? 0) + Number(e.value));
    }
    const prevMonths = [1, 2, 3].map((i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return d.toISOString().slice(0, 7);
    });
    for (const [cat, value] of byCat) {
      const past = prevMonths.map((m) =>
        entries
          .filter(
            (e) =>
              e.type === "expense" &&
              (e.category || "Geral") === cat &&
              e.entry_date.slice(0, 7) === m,
          )
          .reduce((s, e) => s + Number(e.value), 0),
      );
      const historic = past.filter((v) => v > 0);
      if (historic.length < 2) continue;
      const avg = historic.reduce((s, v) => s + v, 0) / historic.length;
      if (avg > 0 && value > avg * 1.5) {
        alerts.push({
          id: `spike-${cat}-${month}`,
          kind: "categorySpike",
          level: "warning",
          title: `\"${cat}\" acima do habitual`,
          body: `${fmt(value, currency)} este mês, contra uma média de ${fmt(avg, currency)} nos meses anteriores.`,
        });
      }
    }
  }

  if (prefs.inactivity) {
    const last = entries.reduce((max, e) => (e.entry_date > max ? e.entry_date : max), "");
    if (last) {
      const diff = Math.round(
        (new Date(`${today}T00:00`).getTime() - new Date(`${last}T00:00`).getTime()) / 86400000,
      );
      if (diff >= prefs.inactivityDays) {
        alerts.push({
          id: `inactive-${today}`,
          kind: "inactivity",
          level: "info",
          title: "Sem lançamentos há uns dias",
          body: `O último registo foi há ${diff} dias. Registe o movimento do dia para manter as contas certas.`,
        });
      }
    }
  }

  if (prefs.weeklySummary && now.getDay() === 1) {
    const from = addDays(today, -7);
    const week = totals(entries.filter((e) => e.entry_date >= from && e.entry_date < today));
    if (week.income || week.expense) {
      alerts.push({
        id: `weekly-${today}`,
        kind: "weeklySummary",
        level: "info",
        title: "Resumo da semana passada",
        body: `Entradas ${fmt(week.income, currency)} · Saídas ${fmt(week.expense, currency)} · Saldo ${fmt(week.balance, currency)}.`,
      });
    }
  }

  // Dicas de IA (1–2 prioritárias) como notificações
  if (prefs.aiTip) {
    const insights = buildFinanceInsights(entries, settings);
    for (const tip of insights.slice(0, 2)) {
      const level: AlertLevel =
        tip.tone === "critical"
          ? "danger"
          : tip.tone === "caution"
            ? "warning"
            : tip.tone === "positive"
              ? "success"
              : "info";
      alerts.push({
        id: `ai-${tip.id}`,
        kind: "aiTip",
        level,
        title: `IA: ${tip.title}`,
        body: tip.tip ? `${tip.body} ${tip.tip}` : tip.body,
      });
    }
  }

  return alerts;
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function pushNewAlerts(alerts: SmartAlert[]) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const pushed = readList(PUSHED_KEY);
  const fresh = alerts.filter((a) => !pushed.includes(a.id));
  for (const alert of fresh.slice(0, 3)) {
    try {
      new Notification(alert.title, { body: alert.body, icon: "/app-icon-512.png" });
    } catch {
      /* ignora */
    }
  }
  if (fresh.length) {
    const merged = Array.from(new Set([...pushed, ...fresh.map((a) => a.id)])).slice(-200);
    window.localStorage.setItem(PUSHED_KEY, JSON.stringify(merged));
  }
}
