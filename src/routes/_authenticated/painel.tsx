import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownRight,
  CalendarRange,
  ArrowUpRight,
  BarChart3,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MinusCircle,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { deleteAccount } from "@/lib/account.functions";
import {
  buildBackup,
  downloadBackup,
  loadBackup,
  maybeAutoBackup,
  parseBackup,
  readHistory,
  storeBackup,
  type BackupRecord,
} from "@/lib/backup";
import { exportCsv, exportExcel, exportPdf } from "@/lib/export";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AiInsights } from "@/components/AiInsights";
import { BrandName } from "@/components/BrandName";
import { EntryDialog } from "@/components/EntryDialog";
import { NotificationSettings } from "@/components/NotificationSettings";
import { NotificationsBell } from "@/components/NotificationsBell";
import { SyncBadge } from "@/components/SyncBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffectivePlan } from "@/hooks/use-effective-plan";
import { supabase } from "@/integrations/supabase/client";
import {
  useAuthUser,
  useDeleteEntry,
  useEntries,
  useProfile,
  useSaveEntry,
  useSaveProfile,
  useSaveSettings,
  useRestoreBackup,
  useSettings,
  type EntryInput,
} from "@/lib/data";
import {
  formatDate,
  lastDays,
  monthISO,
  money,
  todayISO,
  totals,
  type Entry,
  type Profile,
  type Settings,
} from "@/lib/finance";
import { getPlanAccess } from "@/lib/plans";
import { SyncProvider, useSync } from "@/lib/sync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel | Finance Flow AI" },
      {
        name: "description",
        content:
          "Visão geral, lançamentos, insights de IA e definições sincronizados em tempo real.",
      },
      { property: "og:title", content: "Painel | Finance Flow AI" },
      {
        property: "og:description",
        content: "Todos os lançamentos do seu negócio, sincronizados em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PainelRoute,
});

const VIEWS = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "records", label: "Lançamentos", icon: ListOrdered },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "settings", label: "Definições", icon: Settings2 },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

function PainelRoute() {
  const { userId, email, ready } = useAuthUser();
  if (!ready) return <FullPageLoader />;
  return (
    <SyncProvider userId={userId}>
      <Painel userId={userId} email={email} />
    </SyncProvider>
  );
}

function FullPageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <div className="size-9 animate-spin rounded-full border-2 border-border border-t-primary" />
      <p className="text-sm text-muted-foreground">A carregar os seus dados…</p>
    </div>
  );
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1).replace(" de ", " ");
}



function Painel({ userId, email }: { userId: string | null; email: string | null }) {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewId>("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [preset, setPreset] = useState<"withdrawal" | undefined>();

  const entriesQuery = useEntries(userId);
  const settingsQuery = useSettings(userId);
  const profileQuery = useProfile(userId);
  const { plan: effectivePlan } = useEffectivePlan(userId);
  const saveEntry = useSaveEntry(userId);
  const deleteEntry = useDeleteEntry(userId);
  const saveSettings = useSaveSettings(userId);
  const saveProfile = useSaveProfile(userId);
  const restoreBackup = useRestoreBackup(userId);

  const entries = entriesQuery.data ?? [];

  // --- Separação por mês (apenas filtragem, nenhum dado é alterado) ---
  const currentMonth = monthISO();
  const [period, setPeriod] = useState<string>(currentMonth);
  const monthOptions = useMemo(() => {
    const set = new Set<string>(entries.map((e) => e.entry_date.slice(0, 7)));
    set.add(currentMonth);
    return [...set].filter(Boolean).sort((a, b) => b.localeCompare(a));
  }, [entries, currentMonth]);
  const visible = useMemo(
    () => (period === "all" ? entries : entries.filter((e) => e.entry_date.slice(0, 7) === period)),
    [entries, period],
  );
  const periodLabel = period === "all" ? "Todos os meses" : monthLabel(period);
  const goalMonth = period === "all" ? currentMonth : period;

  const goal = Number(settingsQuery.data?.monthly_goal ?? 0);
  const t = totals(visible);
  const today = totals(visible.filter((e) => e.entry_date === todayISO()));
  const monthIncome = totals(entries.filter((e) => e.entry_date.slice(0, 7) === goalMonth)).income;
  const pct = goal ? Math.min(100, (monthIncome / goal) * 100) : 0;
  const planAccess = getPlanAccess(profileQuery.data, entries, effectivePlan);

  useEffect(() => {
    maybeAutoBackup(entries, settingsQuery.data ?? null, profileQuery.data ?? null);
  }, [entries.length, settingsQuery.data, profileQuery.data]);

  function openNew(withdrawal?: boolean) {
    if (!planAccess.canCreateEntry) {
      toast.warning(planAccess.limitMessage, {
        action: { label: "Ver planos", onClick: () => void navigate({ to: "/planos" }) },
      });
      return;
    }
    setEditing(null);
    setPreset(withdrawal ? "withdrawal" : undefined);
    setDialogOpen(true);
  }

  function openEdit(entry: Entry) {
    setEditing(entry);
    setPreset(undefined);
    setDialogOpen(true);
  }

  function handleSubmit(input: EntryInput) {
    if (!editing && !planAccess.canCreateEntry) {
      toast.warning(planAccess.limitMessage, {
        action: { label: "Ver planos", onClick: () => void navigate({ to: "/planos" }) },
      });
      return;
    }
    saveEntry.mutate(input, {
      onSuccess: () => {
        setDialogOpen(false);
        toast.success(editing ? "Lançamento atualizado." : "Lançamento guardado na nuvem.");
      },
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", search: { modo: "entrar" }, replace: true });
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[268px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-border/70 bg-sidebar/85 px-4 py-3 backdrop-blur-xl lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0 lg:px-6 lg:py-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <Sparkles className="size-4.5" />
            </span>
            <BrandName className="text-[15px]" />
          </div>
          <ThemeToggle className="lg:hidden" />
        </div>

        <div className="mt-6 hidden rounded-2xl border border-border bg-accent/60 p-3.5 lg:block">
          <strong className="block truncate text-sm text-accent-foreground">
            {profileQuery.data?.company_name ?? "O meu negócio"}
          </strong>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        </div>

        <nav className="mt-4 flex gap-1.5 overflow-x-auto pb-1 lg:mt-6 lg:grid lg:gap-1 lg:pb-0">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm whitespace-nowrap transition-all duration-200",
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                {v.label}
                {active && (
                  <span className="absolute inset-y-2 left-0 hidden w-0.5 rounded-full bg-primary lg:block" />
                )}
              </button>
            );
          })}
        </nav>

        <Link
          to="/planos"
          className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-xs transition-colors hover:bg-accent/60"
        >
          <span className="font-semibold">Plano {planAccess.planName}</span>
          <span className="text-muted-foreground">
            {planAccess.limit === null
              ? "Ilimitado"
              : `${planAccess.usedThisMonth}/${planAccess.limit}`}
          </span>
        </Link>

        <div className="mt-auto hidden pt-8 lg:block">
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            className="mt-4 flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            <LogOut className="size-3.5" />
            Terminar sessão
          </button>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-[1500px] px-5 py-7 lg:px-10 lg:py-9">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4 animate-fade-up">
          <div>
            <p className="eyebrow">
              {new Date().toLocaleDateString("pt-PT", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight lg:text-[2.1rem]">
              {VIEWS.find((v) => v.id === view)?.label}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              A ver <span className="font-semibold text-foreground">{periodLabel}</span>
              {" · "}
              {visible.length} lançamento{visible.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-2.5 py-1">
              <CalendarRange className="size-4 text-primary" />
              <select
                aria-label="Período"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-7 bg-transparent text-sm font-medium outline-none"
              >
                <option value="all">Todos os meses</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <SyncBadge />
            <NotificationsBell entries={entries} settings={settingsQuery.data ?? null} />
            <div className="flex items-center rounded-lg border border-border/70 bg-card/60 p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                onClick={() =>
                  void exportPdf(visible, {
                    company: profileQuery.data?.company_name ?? "Relatório financeiro",
                    currency: settingsQuery.data?.currency ?? "EUR",
                  })
                }
              >
                <FileText className="size-4" />
                PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                onClick={() => void exportExcel(visible, settingsQuery.data?.currency ?? "EUR")}
              >
                <FileSpreadsheet className="size-4" />
                Excel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                onClick={() => exportCsv(visible)}
              >
                <Download className="size-4" />
                CSV
              </Button>
            </div>
            <Button onClick={() => openNew()} className="shadow-sm">
              <Plus className="size-4" />
              Novo lançamento
            </Button>
            <Button variant="outline" onClick={() => openNew(true)}>
              <MinusCircle className="size-4" />
              Retirada de caixa
            </Button>
          </div>
        </header>

        {entriesQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="panel h-28 animate-pulse p-5" />
            ))}
          </div>
        ) : entriesQuery.isError ? (
          <div className="panel p-6">
            <p className="text-sm text-destructive">Não foi possível carregar os dados da nuvem.</p>
            <Button className="mt-4" variant="outline" onClick={() => entriesQuery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {view === "dashboard" && (
              <section className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Saldo atual" value={money(t.balance)} hint="Disponível em caixa" icon={Wallet} index={0} />
                  <Metric label="Total de entradas" value={money(t.income)} hint={`${visible.filter((e) => e.type === "income").length} lançamentos`} tone="success" icon={ArrowUpRight} index={1} />
                  <Metric label="Total de saídas" value={money(t.expense)} hint={`${visible.filter((e) => e.type === "expense").length} lançamentos`} tone="danger" icon={ArrowDownRight} index={2} />
                  <Metric label="Lucro líquido" value={money(t.balance)} hint={`Hoje: ${money(today.balance)}`} tone={t.balance >= 0 ? "success" : "danger"} icon={TrendingUp} index={3} />
                </div>
                <AiInsights entries={visible} settings={settingsQuery.data ?? null} />
                <div className="grid gap-4 lg:grid-cols-[1.45fr_0.85fr]">
                  <div className="panel panel-crown p-5 lg:p-6 animate-fade-up">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="font-display text-base font-semibold">Fluxo de caixa</h2>
                      <span className="text-xs text-muted-foreground">Últimos 7 dias</span>
                    </div>
                    <div className="mt-5 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={lastDays(visible)}>
                          <defs>
                            <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--success)" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="date" tickFormatter={(d: string) => new Date(`${d}T00:00`).toLocaleDateString("pt-PT", { weekday: "short" })} tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                          <YAxis tickLine={false} axisLine={false} fontSize={11} width={48} stroke="var(--muted-foreground)" />
                          <Tooltip cursor={{ stroke: "var(--border)" }} contentStyle={CHART_TOOLTIP} labelStyle={{ color: "var(--muted-foreground)", fontSize: 11 }} formatter={(v: number) => money(Number(v))} />
                          <Area type="monotone" dataKey="income" name="Entradas" stroke="var(--success)" fill="url(#gIncome)" strokeWidth={2.5} animationDuration={700} />
                          <Area type="monotone" dataKey="expense" name="Saídas" stroke="var(--destructive)" fill="url(#gExpense)" strokeWidth={2.5} animationDuration={700} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="panel p-5 lg:p-6 animate-fade-up">
                    <div className="flex items-center gap-2">
                      <Target className="size-4 text-primary" />
                      <h2 className="font-display text-base font-semibold">Meta mensal</h2>
                    </div>
                    <p className="numeric mt-4 text-3xl font-bold tracking-tight">{goal ? money(goal) : "Defina uma meta"}</p>
                    <div className="my-4 h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-linear-to-r from-primary-dark to-primary transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="numeric flex justify-between text-xs text-muted-foreground">
                      <span>{money(monthIncome)} alcançados</span>
                      <span className="font-semibold text-primary-dark">{Math.round(pct)}%</span>
                    </div>
                    <GoalForm goal={goal} saving={saveSettings.isPending} onSave={(value) => saveSettings.mutate({ monthly_goal: value }, { onSuccess: () => toast.success("Meta mensal atualizada.") })} />
                  </div>
                </div>
                <RecordsTable entries={visible.slice(0, 5)} title="Últimos lançamentos" onEdit={openEdit} onDelete={(id) => deleteEntry.mutate(id)} />
              </section>
            )}
            {view === "records" && <RecordsView entries={visible} onEdit={openEdit} onDelete={(id) => deleteEntry.mutate(id)} />}
            {view === "reports" && <ReportsView entries={visible} />}
            {view === "settings" && (
              <SettingsView
                companyName={profileQuery.data?.company_name ?? ""}
                ownerName={profileQuery.data?.owner_name ?? ""}
                saving={saveProfile.isPending}
                email={email}
                entries={entries}
                settings={settingsQuery.data ?? null}
                profile={profileQuery.data ?? null}
                onRestore={(list) => restoreBackup.mutate(list)}
                restoring={restoreBackup.isPending}
                onSave={(patch) => saveProfile.mutate(patch, { onSuccess: () => toast.success("Perfil atualizado em todos os dispositivos.") })}
                onSignOut={handleSignOut}
              />
            )}
          </>
        )}
      </main>

      <EntryDialog open={dialogOpen} entry={editing} preset={preset} saving={saveEntry.isPending} onOpenChange={setDialogOpen} onSubmit={handleSubmit} />
    </div>
  );
}

const CHART_TOOLTIP = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "var(--shadow-panel)",
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

function Metric({ label, value, hint, tone, icon: Icon, index = 0 }: { label: string; value: string; hint: string; tone?: "success" | "danger"; icon: typeof Wallet; index?: number }) {
  return (
    <article className="panel panel-lift p-5 animate-fade-up" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <span className={cn("grid size-8 place-items-center rounded-lg", tone === "success" ? "bg-success-soft text-success" : tone === "danger" ? "bg-danger-soft text-destructive" : "bg-primary-soft text-primary-dark")}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className={cn("numeric mt-3 text-2xl font-bold tracking-tight", tone === "success" && "text-success", tone === "danger" && "text-destructive")}>{value}</div>
      <small className="text-muted-foreground">{hint}</small>
    </article>
  );
}

function GoalForm({ goal, saving, onSave }: { goal: number; saving: boolean; onSave: (value: number) => void }) {
  const [value, setValue] = useState(String(goal || ""));
  return (
    <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); onSave(Number(value) || 0); }}>
      <Input type="number" step="0.01" min="0" placeholder="Meta de entradas" value={value} onChange={(e) => setValue(e.target.value)} />
      <Button type="submit" variant="outline" disabled={saving}>{saving ? "…" : "Guardar"}</Button>
    </form>
  );
}

function RecordsView({ entries, onEdit, onDelete }: { entries: Entry[]; onEdit: (e: Entry) => void; onDelete: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const categories = useMemo(() => [...new Set(entries.map((e) => e.category))].filter(Boolean).sort(), [entries]);
  const filtered = entries.filter((e) => {
    const haystack = `${e.description} ${e.category} ${e.client} ${e.notes} ${e.payment}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (!date || e.entry_date === date) && (!type || e.type === type) && (!category || e.category === category);
  });
  const selectClass = "h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40";
  return (
    <section className="grid gap-4 animate-fade-up">
      <div className="panel flex flex-wrap gap-2 p-3">
        <Input className="min-w-48 flex-1 bg-card" type="search" placeholder="Procurar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input className="w-auto bg-card" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="income">Entradas</option>
          <option value="expense">Saídas</option>
        </select>
        <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <Button variant="ghost" onClick={() => { setSearch(""); setDate(""); setType(""); setCategory(""); }}>Limpar</Button>
      </div>
      <RecordsTable entries={filtered} onEdit={onEdit} onDelete={onDelete} showPayment />
    </section>
  );
}

function RecordsTable({ entries, title, showPayment, onEdit, onDelete }: { entries: Entry[]; title?: string; showPayment?: boolean; onEdit: (e: Entry) => void; onDelete: (id: string) => void }) {
  return (
    <div className="panel p-5 lg:p-6 animate-fade-up">
      {title && <h2 className="mb-4 font-display text-base font-semibold">{title}</h2>}
      <div className="overflow-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="text-left text-[11px] tracking-wider text-muted-foreground uppercase">
              <th className="px-2 pb-3 font-semibold">Data</th>
              <th className="px-2 pb-3 font-semibold">Descrição</th>
              <th className="px-2 pb-3 font-semibold">Categoria</th>
              {showPayment && <th className="px-2 pb-3 font-semibold">Pagamento</th>}
              <th className="px-2 pb-3 text-right font-semibold">Tipo</th>
              <th className="px-2 pb-3 text-right font-semibold">Valor</th>
              <th className="px-2 pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">Ainda não tem lançamentos. Comece por adicionar o primeiro.</td></tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="group border-t border-border transition-colors hover:bg-accent/40">
                <td className="numeric px-2 py-3 text-sm whitespace-nowrap">{formatDate(e.entry_date)}</td>
                <td className="px-2 py-3 text-sm"><strong className="font-semibold">{e.description}</strong>{e.client && <div className="text-xs text-muted-foreground">{e.client}</div>}</td>
                <td className="px-2 py-3 text-xs text-muted-foreground">{e.category}</td>
                {showPayment && <td className="px-2 py-3 text-xs text-muted-foreground">{e.payment || "—"}</td>}
                <td className="px-2 py-3">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", e.type === "income" ? "bg-success-soft text-success" : "bg-danger-soft text-destructive")}>
                    {e.type === "income" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {e.type === "income" ? "Entrada" : "Saída"}
                  </span>
                </td>
                <td className={cn("numeric px-2 py-3 text-right text-sm font-bold whitespace-nowrap", e.type === "income" ? "text-success" : "text-destructive")}>
                  {e.type === "income" ? "+" : "−"} {money(Number(e.value))}
                </td>
                <td className="px-2 py-3 text-right whitespace-nowrap">
                  <div className="inline-flex gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    <button className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary-dark" onClick={() => onEdit(e)} aria-label="Editar"><Pencil className="size-3.5" /></button>
                    <button className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-danger-soft hover:text-destructive" onClick={() => { if (confirm("Eliminar este lançamento em todos os dispositivos?")) onDelete(e.id); }} aria-label="Eliminar"><Trash2 className="size-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsView({ entries }: { entries: Entry[] }) {
  const t = totals(entries);
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    entries.filter((e) => e.type === "expense").forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + Number(e.value)));
    return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [entries]);
  return (
    <section className="grid gap-4 animate-fade-up lg:grid-cols-[1.4fr_0.9fr]">
      <div className="panel panel-crown p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold">Saídas por categoria</h2>
        <div className="mt-5 h-72">
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Adicione saídas para ver os gastos por categoria.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={CHART_TOOLTIP} formatter={(v: number) => money(Number(v))} />
                <Bar dataKey="total" fill="var(--destructive)" radius={8} animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="panel grid gap-5 p-5 lg:p-6">
        <Summary label="Margem líquida" value={`${t.income ? Math.round((t.balance / t.income) * 100) : 0}%`} />
        <Summary label="Média por lançamento" value={money(entries.length ? (t.income + t.expense) / entries.length : 0)} />
        <Summary label="Número de movimentos" value={String(entries.length)} />
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="numeric text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function SettingsView({
  companyName, ownerName, email, saving, entries, settings, profile, restoring, onRestore, onSave, onSignOut,
}: {
  companyName: string; ownerName: string; email: string | null; saving: boolean; entries: Entry[]; settings: Settings | null; profile: Profile | null; restoring: boolean;
  onRestore: (entries: Entry[]) => void; onSave: (patch: { company_name: string; owner_name: string }) => void; onSignOut: () => void;
}) {
  const [company, setCompany] = useState(companyName);
  const [owner, setOwner] = useState(ownerName);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { state, lastSyncedAt, pending } = useSync();
  const [history, setHistory] = useState<BackupRecord[]>(() => readHistory());

  return (
    <section className="grid gap-4 animate-fade-up lg:grid-cols-2">
      <div className="panel p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold">Perfil</h2>
        <form className="mt-4 grid gap-4" onSubmit={(e) => { e.preventDefault(); onSave({ company_name: company.trim() || "O meu negócio", owner_name: owner.trim() }); }}>
          <div className="grid gap-1.5"><Label htmlFor="company">Nome do negócio</Label><Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="owner">Responsável</Label><Input id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Conta</Label><p className="text-sm text-muted-foreground">{email}</p></div>
          <Button type="submit" disabled={saving} className="justify-self-start">{saving ? "A guardar…" : "Guardar"}</Button>
        </form>
      </div>
      <NotificationSettings />
      <div className="grid gap-4">
        <div className="panel p-5 lg:p-6">
          <h2 className="font-display text-base font-semibold">Sincronização</h2>
          <p className="mt-2 text-sm text-muted-foreground">Todos os dados vivem na nuvem, na sua conta. Entre com o mesmo e-mail no iPhone e no computador para ver exatamente os mesmos lançamentos.</p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Estado</dt><dd><SyncBadge /></dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Última sincronização</dt><dd className="numeric">{lastSyncedAt ? lastSyncedAt.toLocaleTimeString("pt-PT") : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Alterações por enviar</dt><dd className="numeric">{pending}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Ligação em tempo real</dt><dd>{state === "synced" ? "Ativa" : state === "offline" ? "Sem internet" : "A ligar"}</dd></div>
          </dl>
          <Button variant="outline" className="mt-6" onClick={onSignOut}><LogOut className="size-4" />Terminar sessão</Button>
        </div>
        <div className="panel p-5 lg:p-6">
          <h2 className="font-display text-base font-semibold">Segurança da conta</h2>
          <p className="mt-2 text-sm text-muted-foreground">Defina uma nova palavra-passe. Aplica-se de imediato em todos os dispositivos.</p>
          <form className="mt-4 grid gap-3" onSubmit={async (e) => {
            e.preventDefault();
            if (newPassword.length < 6) { toast.error("A palavra-passe tem de ter pelo menos 6 caracteres."); return; }
            setChangingPassword(true);
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            setChangingPassword(false);
            if (error) toast.error(error.message);
            else { setNewPassword(""); toast.success("Palavra-passe alterada."); }
          }}>
            <div className="grid gap-1.5"><Label htmlFor="new-password">Nova palavra-passe</Label><Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <Button type="submit" disabled={changingPassword} className="justify-self-start">{changingPassword ? "A alterar…" : "Alterar palavra-passe"}</Button>
          </form>
        </div>
        <div className="panel p-5 lg:p-6">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold"><DatabaseBackup className="size-4 text-primary" />Backup e restauro</h2>
          <p className="mt-2 text-sm text-muted-foreground">É criado um backup automático por dia neste dispositivo. Pode também guardar um ficheiro seguro no computador e restaurá-lo num clique.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { const backup = buildBackup(entries, settings, profile); storeBackup(backup, false); downloadBackup(backup); setHistory(readHistory()); toast.success("Backup criado e transferido."); }}>
              <Download className="size-4" />Criar backup agora
            </Button>
            <label className="inline-flex">
              <input type="file" accept="application/json" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
                try { const backup = parseBackup(await file.text()); onRestore(backup.entries); } catch (error) { toast.error((error as Error).message); }
              }} />
              <Button asChild variant="outline" disabled={restoring}><span>{restoring ? "A restaurar…" : "Restaurar de ficheiro"}</span></Button>
            </label>
          </div>
          <div className="mt-5">
            <p className="eyebrow">Histórico neste dispositivo</p>
            {history.length === 0 ? (<p className="mt-2 text-sm text-muted-foreground">Ainda sem backups guardados.</p>) : (
              <ul className="mt-2 grid gap-2">
                {history.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                    <span className="min-w-0"><span className="numeric">{new Date(item.created_at).toLocaleString("pt-PT")}</span><span className="ml-2 text-muted-foreground">{item.entries} lançamentos · {item.auto ? "automático" : "manual"}</span></span>
                    <Button size="sm" variant="ghost" disabled={restoring} onClick={() => { const backup = loadBackup(item.id); if (!backup) { toast.error("Backup indisponível."); return; } onRestore(backup.entries); }}>Restaurar</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="panel p-5 lg:p-6">
          <h2 className="font-display text-base font-semibold">Aparência</h2>
          <p className="mt-2 text-sm text-muted-foreground">Escolha entre o tema claro, o tema escuro premium ou deixe seguir automaticamente as definições do seu dispositivo.</p>
          <ThemeToggle className="mt-4" />
        </div>
        <div className="panel border-destructive/40 p-5 lg:p-6">
          <h2 className="font-display text-base font-semibold text-destructive">Apagar conta</h2>
          <p className="mt-2 text-sm text-muted-foreground">Elimina permanentemente a sua conta e todos os lançamentos, em todos os dispositivos (RGPD, direito ao apagamento). Esta ação não pode ser revertida.</p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5"><Label htmlFor="delete-confirm">Escreva <span className="font-semibold">APAGAR</span> para confirmar</Label><Input id="delete-confirm" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} /></div>
            <Button variant="destructive" className="justify-self-start" disabled={deleteConfirm.trim().toUpperCase() !== "APAGAR" || deleting} onClick={async () => {
              setDeleting(true);
              try { await deleteAccount(); await supabase.auth.signOut(); window.location.href = "/"; }
              catch (error) { setDeleting(false); toast.error((error as Error).message ?? "Não foi possível apagar a conta."); }
            }}>{deleting ? "A apagar…" : "Apagar conta definitivamente"}</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
