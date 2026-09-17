import type { Entry } from "@/lib/finance";

export const monthLabelOf = (month: string) => {
  const [y, m] = month.split("-");
  const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1).replace(" de ", " ");
};

export const previousMonthOf = (month: string) => {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const daysInMonthOf = (month: string) => {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
};

export const dayOf = (iso: string) => Number(iso.slice(8, 10)) || 0;

export const normalizeKey = (text: string) =>
  (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Safe percent change; null when there is no comparable base. */
export const pctChange = (current: number, previous: number): number | null => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

export const fmtPct = (value: number | null) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export interface ComparisonRange {
  selectedMonth: string;
  previousMonth: string;
  /** Last day (inclusive) considered in each month. */
  cutoffDay: number;
  currentCutoff: number;
  previousCutoff: number;
  partial: boolean;
}

export function buildRange(
  selectedMonth: string,
  sameDay: boolean,
  currentMonth: string,
  today: string,
): ComparisonRange {
  const previousMonth = previousMonthOf(selectedMonth);
  const isCurrentMonth = selectedMonth === currentMonth;
  const rawCutoff = isCurrentMonth && sameDay ? dayOf(today) : daysInMonthOf(selectedMonth);
  const currentCutoff = Math.min(Math.max(rawCutoff, 1), daysInMonthOf(selectedMonth));
  const previousCutoff = Math.min(currentCutoff, daysInMonthOf(previousMonth));
  return {
    selectedMonth,
    previousMonth,
    cutoffDay: currentCutoff,
    currentCutoff,
    previousCutoff,
    partial: isCurrentMonth && sameDay,
  };
}

export const inPeriod = (entry: Entry, month: string, cutoff: number) =>
  entry.entry_date.slice(0, 7) === month && dayOf(entry.entry_date) <= cutoff;

export function splitIncome(entries: Entry[], range: ComparisonRange) {
  const income = entries.filter((e) => e.type === "income");
  return {
    current: income.filter((e) => inPeriod(e, range.selectedMonth, range.currentCutoff)),
    previous: income.filter((e) => inPeriod(e, range.previousMonth, range.previousCutoff)),
  };
}

export const sumValue = (list: Entry[]) => list.reduce((s, e) => s + Number(e.value || 0), 0);

export interface GroupRow {
  key: string;
  label: string;
  previous: number;
  current: number;
  difference: number;
  percent: number | null;
  previousCount: number;
  currentCount: number;
  previousTicket: number;
  currentTicket: number;
  share: number | null;
}

export function groupCompare(
  current: Entry[],
  previous: Entry[],
  field: (e: Entry) => string,
  emptyLabel: string,
  totalDifference: number,
): GroupRow[] {
  const map = new Map<string, GroupRow>();
  const touch = (entry: Entry, side: "current" | "previous") => {
    const raw = (field(entry) ?? "").trim();
    const label = raw || emptyLabel;
    const key = normalizeKey(label) || emptyLabel;
    const row =
      map.get(key) ??
      ({
        key,
        label,
        previous: 0,
        current: 0,
        difference: 0,
        percent: null,
        previousCount: 0,
        currentCount: 0,
        previousTicket: 0,
        currentTicket: 0,
        share: null,
      } satisfies GroupRow);
    row[side] += Number(entry.value || 0);
    if (side === "current") row.currentCount += 1;
    else row.previousCount += 1;
    map.set(key, row);
  };
  previous.forEach((e) => touch(e, "previous"));
  current.forEach((e) => touch(e, "current"));

  return [...map.values()]
    .map((row) => ({
      ...row,
      difference: row.current - row.previous,
      percent: pctChange(row.current, row.previous),
      previousTicket: row.previousCount ? row.previous / row.previousCount : 0,
      currentTicket: row.currentCount ? row.current / row.currentCount : 0,
      share:
        totalDifference !== 0 ? ((row.current - row.previous) / Math.abs(totalDifference)) * 100 : null,
    }))
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
}

export function cumulativeSeries(current: Entry[], previous: Entry[], range: ComparisonRange) {
  const days = Math.max(range.currentCutoff, range.previousCutoff);
  let runCurrent = 0;
  let runPrevious = 0;
  return Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    if (day <= range.currentCutoff)
      runCurrent += sumValue(current.filter((e) => dayOf(e.entry_date) === day));
    if (day <= range.previousCutoff)
      runPrevious += sumValue(previous.filter((e) => dayOf(e.entry_date) === day));
    return { day, current: runCurrent, previous: runPrevious };
  });
}

export function vanishedRows(rows: GroupRow[]) {
  return rows
    .filter((r) => r.previous > 0 && (r.current === 0 || r.current <= r.previous * 0.3))
    .sort((a, b) => a.difference - b.difference);
}

export interface DiagnosisInput {
  currentTotal: number;
  previousTotal: number;
  categories: GroupRow[];
  descriptions: GroupRow[];
  payments: GroupRow[];
  money: (n: number) => string;
}

export function buildDiagnosis({
  currentTotal,
  previousTotal,
  categories,
  descriptions,
  payments,
  money,
}: DiagnosisInput): string[] {
  const diff = currentTotal - previousTotal;
  const percent = pctChange(currentTotal, previousTotal);
  const lines: string[] = [];

  if (currentTotal === 0 && previousTotal === 0) {
    return ["Ainda não há receitas registadas em nenhum dos dois períodos para comparar."];
  }

  if (Math.abs(diff) < 0.01) {
    lines.push(`O faturamento está estável face ao período anterior (${money(currentTotal)}).`);
  } else if (diff > 0) {
    lines.push(
      `O faturamento está ${money(Math.abs(diff))} acima do período anterior${percent === null ? "" : ` (${fmtPct(percent)})`}: ${money(previousTotal)} → ${money(currentTotal)}.`,
    );
  } else {
    lines.push(
      `O faturamento está ${money(Math.abs(diff))} abaixo do período anterior${percent === null ? "" : ` (${fmtPct(percent)})`}: ${money(previousTotal)} → ${money(currentTotal)}.`,
    );
  }

  const sign = diff >= 0 ? 1 : -1;
  const main = categories.find((c) => Math.sign(c.difference) === sign && c.difference !== 0);
  if (main) {
    const share =
      diff !== 0 ? Math.min(100, Math.abs((main.difference / diff) * 100)) : null;
    lines.push(
      `${diff >= 0 ? "O maior impulso" : "O maior impacto negativo"} vem de “${main.label}”: ${money(main.previous)} → ${money(main.current)} (${main.difference >= 0 ? "+" : "−"}${money(Math.abs(main.difference))}), com ${main.previousCount} → ${main.currentCount} vendas${share === null ? "" : ` — cerca de ${share.toFixed(0)}% da variação total`}.`,
    );
  }

  const topDescriptions = descriptions
    .filter((d) => Math.sign(d.difference) === sign && d.difference !== 0)
    .slice(0, 3);
  if (topDescriptions.length > 0) {
    lines.push(
      `Descrições de maior impacto: ${topDescriptions
        .map((d) => `${d.label} (${d.difference >= 0 ? "+" : "−"}${money(Math.abs(d.difference))})`)
        .join(", ")}.`,
    );
  }

  const mainPayment = payments.find((p) => Math.sign(p.difference) === sign && p.difference !== 0);
  if (mainPayment) {
    lines.push(
      `Na forma de pagamento, “${mainPayment.label}” é a que mais pesa: ${money(mainPayment.previous)} → ${money(mainPayment.current)} (${mainPayment.difference >= 0 ? "+" : "−"}${money(Math.abs(mainPayment.difference))}).`,
    );
  }

  return lines;
}
