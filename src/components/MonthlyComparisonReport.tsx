import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { formatDate, money, monthISO, todayISO, type Entry } from "@/lib/finance";
import {
  buildDiagnosis,
  buildRange,
  cumulativeSeries,
  fmtPct,
  groupCompare,
  monthLabelOf,
  normalizeKey,
  pctChange,
  splitIncome,
  sumValue,
  vanishedRows,
  type GroupRow,
} from "@/lib/report-analysis";
import { cn } from "@/lib/utils";

const TOOLTIP = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "var(--shadow-panel)",
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

const selectClass =
  "h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40";

type Drill = { title: string; current: Entry[]; previous: Entry[] } | null;

export function MonthlyComparisonReport({
  allEntries,
  period,
}: {
  allEntries: Entry[];
  period: string;
}) {
  const [sameDay, setSameDay] = useState(true);
  const [category, setCategory] = useState("");
  const [payment, setPayment] = useState("");
  const [client, setClient] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [descSearch, setDescSearch] = useState("");
  const [drill, setDrill] = useState<Drill>(null);

  const currentMonth = monthISO();
  const range = useMemo(
    () => buildRange(period === "all" ? currentMonth : period, sameDay, currentMonth, todayISO()),
    [period, sameDay, currentMonth],
  );

  const filtered = useMemo(
    () =>
      allEntries.filter(
        (e) =>
          (!category || normalizeKey(e.category) === category) &&
          (!payment || normalizeKey(e.payment || "Não informado") === payment) &&
          (!client || normalizeKey(e.client) === client),
      ),
    [allEntries, category, payment, client],
  );

  const options = useMemo(() => {
    const uniq = (get: (e: Entry) => string, empty: string) => {
      const map = new Map<string, string>();
      allEntries
        .filter((e) => e.type === "income")
        .forEach((e) => {
          const label = (get(e) ?? "").trim() || empty;
          map.set(normalizeKey(label), label);
        });
      return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    };
    return {
      categories: uniq((e) => e.category, "Sem categoria"),
      payments: uniq((e) => e.payment, "Não informado"),
      clients: uniq((e) => e.client, "Sem cliente"),
    };
  }, [allEntries]);

  const { current, previous } = useMemo(() => splitIncome(filtered, range), [filtered, range]);
  const currentTotal = sumValue(current);
  const previousTotal = sumValue(previous);
  const difference = currentTotal - previousTotal;
  const percent = pctChange(currentTotal, previousTotal);
  const ticketCurrent = current.length ? currentTotal / current.length : 0;
  const ticketPrevious = previous.length ? previousTotal / previous.length : 0;

  const categories = useMemo(
    () => groupCompare(current, previous, (e) => e.category, "Sem categoria", difference),
    [current, previous, difference],
  );
  const payments = useMemo(
    () => groupCompare(current, previous, (e) => e.payment, "Não informado", difference),
    [current, previous, difference],
  );
  const descriptions = useMemo(
    () => groupCompare(current, previous, (e) => e.description, "Sem descrição", difference),
    [current, previous, difference],
  );
  const vanished = useMemo(
    () =>
      [
        ...vanishedRows(categories).map((row) => ({ row, source: "category" as const })),
        ...vanishedRows(descriptions).map((row) => ({ row, source: "description" as const })),
      ]
        .sort((a, b) => a.row.difference - b.row.difference)
        .slice(0, 12),
    [categories, descriptions],
  );
  const series = useMemo(() => cumulativeSeries(current, previous, range), [current, previous, range]);
  const diagnosis = useMemo(
    () =>
      buildDiagnosis({
        currentTotal,
        previousTotal,
        categories,
        descriptions,
        payments,
        money: (n) => money(n),
      }),
    [currentTotal, previousTotal, categories, descriptions, payments],
  );

  const openDrill = (row: GroupRow, field: (e: Entry) => string, empty: string) => {
    const match = (list: Entry[]) =>
      list.filter((e) => (normalizeKey((field(e) ?? "").trim() || empty) || empty) === row.key);
    setDrill({ title: row.label, current: match(current), previous: match(previous) });
  };

  if (period === "all") {
    return (
      <div className="panel panel-crown p-6 text-center">
        <p className="eyebrow">Comparação mensal</p>
        <h2 className="mt-2 font-display text-base font-semibold">Selecione um mês</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Esta análise compara um mês com o mês anterior. Escolha um mês no seletor de período no topo
          para ver o que explica a diferença.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="panel panel-crown p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Comparação mensal · apenas receitas</p>
            <h2 className="mt-1 font-display text-base font-semibold">
              {monthLabelOf(range.selectedMonth)} vs. {monthLabelOf(range.previousMonth)}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {range.partial
                ? `A comparar do dia 1 ao dia ${range.currentCutoff} de cada mês.`
                : "A comparar os meses completos."}
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-xl border bg-background/45 px-4 py-3">
            <Switch checked={sameDay} onCheckedChange={setSameDay} id="same-day" />
            <Label htmlFor="same-day" className="text-xs">Comparar até o mesmo dia do mês</Label>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todos os serviços</option>
            {options.categories.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select className={selectClass} value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="">Todas as formas de pagamento</option>
            {options.payments.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select className={selectClass} value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">Todos os clientes</option>
            {options.clients.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <Button variant="ghost" onClick={() => { setCategory(""); setPayment(""); setClient(""); setServiceSearch(""); setDescSearch(""); }}>
            Limpar filtros
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Stat label={`Faturamento ${monthLabelOf(range.selectedMonth)}`} value={money(currentTotal)} hint={`${current.length} venda${current.length === 1 ? "" : "s"}`} />
          <Stat label={`Período anterior equivalente`} value={money(previousTotal)} hint={`${previous.length} venda${previous.length === 1 ? "" : "s"}`} />
          <Stat
            label="Diferença"
            value={`${difference >= 0 ? "+" : "−"}${money(Math.abs(difference))}`}
            hint={percent === null ? "Sem base comparável" : `${fmtPct(percent)} vs. anterior`}
            tone={difference >= 0 ? "success" : "danger"}
          />
          <Stat label="Vendas" value={`${previous.length} → ${current.length}`} hint={`${current.length - previous.length >= 0 ? "+" : "−"}${Math.abs(current.length - previous.length)} vendas`} tone={current.length >= previous.length ? "success" : "danger"} />
          <Stat label="Ticket médio atual" value={money(ticketCurrent)} hint={`Anterior: ${money(ticketPrevious)}`} />
          <Stat label="Variação do ticket" value={fmtPct(pctChange(ticketCurrent, ticketPrevious))} hint="Receita média por venda" tone={ticketCurrent >= ticketPrevious ? "success" : "danger"} />
        </div>
      </div>

      <div className={cn("panel p-5 lg:p-6", difference >= 0 ? "border-success/30" : "border-destructive/30")}>
        <h2 className="font-display text-base font-semibold">O que explica a diferença?</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
          {diagnosis.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", difference >= 0 ? "bg-success" : "bg-destructive")} />
              <span className="text-foreground/90">{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold">Receita acumulada dia a dia</h2>
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(d: number) => `Dia ${d}`} minTickGap={20} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} stroke="var(--muted-foreground)" tickFormatter={(v: number) => money(Number(v))} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v: number) => money(Number(v))} labelFormatter={(day) => `Dia ${day}`} />
              <Legend />
              <Line type="monotone" dataKey="current" name={monthLabelOf(range.selectedMonth)} stroke="var(--success)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="previous" name={monthLabelOf(range.previousMonth)} stroke="var(--muted-foreground)" strokeWidth={2.5} strokeDasharray="7 5" dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Serviços que explicam a diferença</h2>
          <Input className="w-56 bg-card" type="search" placeholder="Procurar serviço…" value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} />
        </div>
        <GroupTable
          rows={categories.filter((r) => !serviceSearch || normalizeKey(r.label).includes(normalizeKey(serviceSearch)))}
          firstHeader="Serviço / categoria"
          showTickets
          onRow={(row) => openDrill(row, (e) => e.category, "Sem categoria")}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-5 lg:p-6">
          <h2 className="font-display text-base font-semibold">Formas de pagamento</h2>
          <GroupTable rows={payments} firstHeader="Pagamento" onRow={(row) => openDrill(row, (e) => e.payment, "Não informado")} />
        </div>
        <div className="panel p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold">Descrições</h2>
            <Input className="w-52 bg-card" type="search" placeholder="Procurar descrição…" value={descSearch} onChange={(e) => setDescSearch(e.target.value)} />
          </div>
          <GroupTable
            rows={descriptions.filter((r) => !descSearch || normalizeKey(r.label).includes(normalizeKey(descSearch)))}
            firstHeader="Descrição"
            onRow={(row) => openDrill(row, (e) => e.description, "Sem descrição")}
          />
        </div>
      </div>

      <div className="panel p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold">Vendas que sumiram</h2>
        <p className="mt-1 text-xs text-muted-foreground">Serviços e descrições que caíram 70% ou mais face ao período anterior.</p>
        {vanished.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nada desapareceu: todas as fontes de receita mantiveram-se.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {vanished.map(({ row, source }) => (
              <li key={`${source}-${row.key}-${row.previous}`}>
                <button
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                  onClick={() =>
                    source === "category"
                      ? openDrill(row, (e) => e.category, "Sem categoria")
                      : openDrill(row, (e) => e.description, "Sem descrição")
                  }
                >
                  <span className="min-w-0 text-sm font-semibold">{row.label}</span>
                  <span className="numeric text-sm text-muted-foreground">
                    {money(row.previous)} → {money(row.current)} · {row.previousCount} → {row.currentCount} vendas
                    <span className="ml-2 font-bold text-destructive">−{money(Math.abs(row.difference))}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet open={drill !== null} onOpenChange={(open) => { if (!open) setDrill(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{drill?.title}</SheetTitle>
            <SheetDescription>
              Lançamentos de receita nos dois períodos comparados.
            </SheetDescription>
          </SheetHeader>
          {drill && (
            <div className="grid gap-5 px-4 pb-8">
              <DrillBlock title={monthLabelOf(range.selectedMonth)} rows={drill.current} />
              <DrillBlock title={monthLabelOf(range.previousMonth)} rows={drill.previous} />
              <div className="rounded-xl border bg-background/45 p-4">
                <p className="text-xs text-muted-foreground">Diferença</p>
                <p className={cn("numeric mt-1 text-xl font-bold", sumValue(drill.current) - sumValue(drill.previous) >= 0 ? "text-success" : "text-destructive")}>
                  {sumValue(drill.current) - sumValue(drill.previous) >= 0 ? "+" : "−"}
                  {money(Math.abs(sumValue(drill.current) - sumValue(drill.previous)))}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "success" | "danger" }) {
  return (
    <div className="rounded-xl border bg-background/45 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("numeric mt-1 text-2xl font-bold", tone === "success" && "text-success", tone === "danger" && "text-destructive")}>{value}</p>
      <small className="text-muted-foreground">{hint}</small>
    </div>
  );
}

function GroupTable({ rows, firstHeader, showTickets, onRow }: { rows: GroupRow[]; firstHeader: string; showTickets?: boolean; onRow: (row: GroupRow) => void }) {
  if (rows.length === 0) return <p className="mt-4 text-sm text-muted-foreground">Sem receitas para comparar neste recorte.</p>;
  return (
    <div className="mt-4 overflow-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="text-left text-[11px] tracking-wider text-muted-foreground uppercase">
            <th className="px-2 pb-3 font-semibold">{firstHeader}</th>
            <th className="px-2 pb-3 text-right font-semibold">Anterior</th>
            <th className="px-2 pb-3 text-right font-semibold">Atual</th>
            <th className="px-2 pb-3 text-right font-semibold">Diferença</th>
            <th className="px-2 pb-3 text-right font-semibold">%</th>
            <th className="px-2 pb-3 text-right font-semibold">Qtd.</th>
            {showTickets && <th className="px-2 pb-3 text-right font-semibold">Ticket</th>}
            <th className="px-2 pb-3 text-right font-semibold">Impacto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="cursor-pointer border-t border-border transition-colors hover:bg-accent/40" onClick={() => onRow(row)}>
              <td className="px-2 py-3 text-sm font-semibold">{row.label}</td>
              <td className="numeric px-2 py-3 text-right text-sm">{money(row.previous)}</td>
              <td className="numeric px-2 py-3 text-right text-sm">{money(row.current)}</td>
              <td className={cn("numeric px-2 py-3 text-right text-sm font-bold", row.difference >= 0 ? "text-success" : "text-destructive")}>
                {row.difference >= 0 ? "+" : "−"}{money(Math.abs(row.difference))}
              </td>
              <td className={cn("numeric px-2 py-3 text-right text-xs", row.percent !== null && row.percent < 0 ? "text-destructive" : "text-muted-foreground")}>{fmtPct(row.percent)}</td>
              <td className="numeric px-2 py-3 text-right text-xs text-muted-foreground">{row.previousCount} → {row.currentCount}</td>
              {showTickets && <td className="numeric px-2 py-3 text-right text-xs text-muted-foreground">{money(row.previousTicket)} → {money(row.currentTicket)}</td>}
              <td className="numeric px-2 py-3 text-right text-xs text-muted-foreground">{row.share === null ? "—" : `${row.share.toFixed(0)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DrillBlock({ title, rows }: { title: string; rows: Entry[] }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{title}</p>
        <p className="numeric text-sm font-bold">{money(sumValue(rows))}</p>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sem lançamentos neste período.</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {rows.map((e) => (
            <li key={e.id} className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="numeric text-xs text-muted-foreground">{formatDate(e.entry_date)}</span>
                <span className="numeric font-bold">{money(Number(e.value))}</span>
              </div>
              <div className="mt-1 font-semibold">{e.description || "Sem descrição"}</div>
              <div className="text-xs text-muted-foreground">
                {[e.client || "Sem cliente", e.category || "Sem categoria", e.payment || "Não informado"].join(" · ")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
