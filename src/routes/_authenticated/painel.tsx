import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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

import { EntryDialog } from "@/components/EntryDialog";
import { SyncBadge } from "@/components/SyncBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  useAuthUser,
  useDeleteEntry,
  useEntries,
  useProfile,
  useSaveEntry,
  useSaveProfile,
  useSaveSettings,
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
} from "@/lib/finance";
import { SyncProvider, useSync } from "@/lib/sync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel | FINANCEIRO TP" },
      {
        name: "description",
        content:
          "Visão geral, lançamentos, relatórios e definições sincronizados em tempo real entre os seus dispositivos.",
      },
      { property: "og:title", content: "Painel | FINANCEIRO TP" },
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
  { id: "dashboard", label: "Visão geral" },
  { id: "records", label: "Lançamentos" },
  { id: "reports", label: "Relatórios" },
  { id: "settings", label: "Definições" },
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
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      A carregar os seus dados…
    </div>
  );
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
  const saveEntry = useSaveEntry(userId);
  const deleteEntry = useDeleteEntry(userId);
  const saveSettings = useSaveSettings(userId);
  const saveProfile = useSaveProfile(userId);

  const entries = entriesQuery.data ?? [];
  const goal = Number(settingsQuery.data?.monthly_goal ?? 0);
  const t = totals(entries);
  const today = totals(entries.filter((e) => e.entry_date === todayISO()));
  const monthIncome = totals(entries.filter((e) => e.entry_date.slice(0, 7) === monthISO())).income;
  const pct = goal ? Math.min(100, (monthIncome / goal) * 100) : 0;

  function openNew(withdrawal?: boolean) {
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
    saveEntry.mutate(input, {
      onSuccess: () => {
        setDialogOpen(false);
        toast.success(editing ? "Lançamento atualizado." : "Lançamento guardado na nuvem.");
      },
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-border bg-sidebar p-4 lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0 lg:p-7">
        <div className="text-xl font-bold tracking-tight">
          FINANCEI<span className="text-primary">RO TP</span>
        </div>
        <div className="mt-6 hidden rounded-xl border border-border bg-accent p-3 text-xs lg:block">
          <strong className="block text-sm text-accent-foreground">
            {profileQuery.data?.company_name ?? "O meu negócio"}
          </strong>
          <span className="text-muted-foreground">{email}</span>
        </div>
        <nav className="mt-5 flex gap-1 overflow-auto lg:grid">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm whitespace-nowrap transition-colors",
                view === v.id
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              {v.label}
            </button>
          ))}
        </nav>
        <button
          onClick={handleSignOut}
          className="mt-6 hidden text-xs text-muted-foreground underline-offset-4 hover:underline lg:block"
        >
          Terminar sessão
        </button>
      </aside>

      <main className="mx-auto w-full max-w-[1500px] px-5 py-7 lg:px-9">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">
              {new Date().toLocaleDateString("pt-PT", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {VIEWS.find((v) => v.id === view)?.label}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SyncBadge />
            <Button variant="outline" onClick={() => exportCsv(entries)}>
              Exportar CSV
            </Button>
            <Button onClick={() => openNew()}>+ Novo lançamento</Button>
            <Button variant="destructive" onClick={() => openNew(true)}>
              Retirada de caixa
            </Button>
          </div>
        </header>

        {entriesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">A sincronizar os seus lançamentos…</p>
        ) : entriesQuery.isError ? (
          <div className="panel p-6">
            <p className="text-sm text-destructive">
              Não foi possível carregar os dados da nuvem.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => entriesQuery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {view === "dashboard" && (
              <section className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Saldo atual" value={money(t.balance)} hint="Disponível em caixa" />
                  <Metric
                    label="Total de entradas"
                    value={money(t.income)}
                    hint={`${entries.filter((e) => e.type === "income").length} lançamentos`}
                    tone="success"
                  />
                  <Metric
                    label="Total de saídas"
                    value={money(t.expense)}
                    hint={`${entries.filter((e) => e.type === "expense").length} lançamentos`}
                    tone="danger"
                  />
                  <Metric
                    label="Lucro líquido"
                    value={money(t.balance)}
                    hint={`Hoje: ${money(today.balance)}`}
                    tone={t.balance >= 0 ? "success" : "danger"}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.45fr_0.85fr]">
                  <div className="panel p-5">
                    <h2 className="text-base font-semibold">Fluxo de caixa</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Últimos 7 dias</p>
                    <div className="mt-4 h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={lastDays(entries)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(d: string) =>
                              new Date(`${d}T00:00`).toLocaleDateString("pt-PT", { weekday: "short" })
                            }
                            tickLine={false}
                            axisLine={false}
                            fontSize={11}
                          />
                          <YAxis tickLine={false} axisLine={false} fontSize={11} width={45} />
                          <Tooltip formatter={(v: number) => money(Number(v))} />
                          <Area
                            type="monotone"
                            dataKey="income"
                            name="Entradas"
                            stroke="var(--success)"
                            fill="var(--success-soft)"
                            strokeWidth={3}
                          />
                          <Area
                            type="monotone"
                            dataKey="expense"
                            name="Saídas"
                            stroke="var(--destructive)"
                            fill="var(--danger-soft)"
                            strokeWidth={3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="panel p-5">
                    <h2 className="text-base font-semibold">Meta mensal</h2>
                    <p className="mt-3 text-2xl font-bold tracking-tight">
                      {goal ? money(goal) : "Defina uma meta"}
                    </p>
                    <div className="my-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{money(monthIncome)} alcançados</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <GoalForm
                      goal={goal}
                      saving={saveSettings.isPending}
                      onSave={(value) =>
                        saveSettings.mutate(
                          { monthly_goal: value },
                          { onSuccess: () => toast.success("Meta mensal atualizada.") },
                        )
                      }
                    />
                  </div>
                </div>

                <RecordsTable
                  entries={entries.slice(0, 5)}
                  title="Últimos lançamentos"
                  onEdit={openEdit}
                  onDelete={(id) => deleteEntry.mutate(id)}
                />
              </section>
            )}

            {view === "records" && (
              <RecordsView
                entries={entries}
                onEdit={openEdit}
                onDelete={(id) => deleteEntry.mutate(id)}
              />
            )}

            {view === "reports" && <ReportsView entries={entries} />}

            {view === "settings" && (
              <SettingsView
                companyName={profileQuery.data?.company_name ?? ""}
                ownerName={profileQuery.data?.owner_name ?? ""}
                saving={saveProfile.isPending}
                email={email}
                onSave={(patch) =>
                  saveProfile.mutate(patch, {
                    onSuccess: () => toast.success("Perfil atualizado em todos os dispositivos."),
                  })
                }
                onSignOut={handleSignOut}
              />
            )}
          </>
        )}
      </main>

      <EntryDialog
        open={dialogOpen}
        entry={editing}
        preset={preset}
        saving={saveEntry.isPending}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "success" | "danger";
}) {
  return (
    <article className="panel p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-2.5 text-2xl font-bold tracking-tight",
          tone === "success" && "text-success",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </div>
      <small className="text-muted-foreground">{hint}</small>
    </article>
  );
}

function GoalForm({
  goal,
  saving,
  onSave,
}: {
  goal: number;
  saving: boolean;
  onSave: (value: number) => void;
}) {
  const [value, setValue] = useState(String(goal || ""));
  return (
    <form
      className="mt-5 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Number(value) || 0);
      }}
    >
      <Input
        type="number"
        step="0.01"
        min="0"
        placeholder="Meta de entradas"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button type="submit" variant="outline" disabled={saving}>
        {saving ? "…" : "Guardar"}
      </Button>
    </form>
  );
}

function RecordsView({
  entries,
  onEdit,
  onDelete,
}: {
  entries: Entry[];
  onEdit: (e: Entry) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");

  const categories = useMemo(
    () => [...new Set(entries.map((e) => e.category))].filter(Boolean).sort(),
    [entries],
  );

  const filtered = entries.filter((e) => {
    const haystack = `${e.description} ${e.category} ${e.client} ${e.notes} ${e.payment}`.toLowerCase();
    return (
      (!search || haystack.includes(search.toLowerCase())) &&
      (!date || e.entry_date === date) &&
      (!type || e.type === type) &&
      (!category || e.category === category)
    );
  });

  const selectClass =
    "h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-48 flex-1 bg-card"
          type="search"
          placeholder="Procurar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Input
          className="w-auto bg-card"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="income">Entradas</option>
          <option value="expense">Saídas</option>
        </select>
        <select
          className={selectClass}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          onClick={() => {
            setSearch("");
            setDate("");
            setType("");
            setCategory("");
          }}
        >
          Limpar
        </Button>
      </div>
      <RecordsTable entries={filtered} onEdit={onEdit} onDelete={onDelete} showPayment />
    </section>
  );
}

function RecordsTable({
  entries,
  title,
  showPayment,
  onEdit,
  onDelete,
}: {
  entries: Entry[];
  title?: string;
  showPayment?: boolean;
  onEdit: (e: Entry) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="panel p-5">
      {title && <h2 className="mb-4 text-base font-semibold">{title}</h2>}
      <div className="overflow-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="text-left text-[11px] tracking-wider text-muted-foreground uppercase">
              <th className="px-2 pb-3">Data</th>
              <th className="px-2 pb-3">Descrição</th>
              <th className="px-2 pb-3">Categoria</th>
              {showPayment && <th className="px-2 pb-3">Pagamento</th>}
              <th className="px-2 pb-3">Tipo</th>
              <th className="px-2 pb-3 text-right">Valor</th>
              <th className="px-2 pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Ainda não tem lançamentos. Comece por adicionar o primeiro.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="px-2 py-3 text-sm">{formatDate(e.entry_date)}</td>
                <td className="px-2 py-3 text-sm">
                  <strong>{e.description}</strong>
                  {e.client && <div className="text-xs text-muted-foreground">{e.client}</div>}
                </td>
                <td className="px-2 py-3 text-xs text-muted-foreground">{e.category}</td>
                {showPayment && (
                  <td className="px-2 py-3 text-xs text-muted-foreground">{e.payment || "—"}</td>
                )}
                <td className="px-2 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[11px] font-bold",
                      e.type === "income"
                        ? "bg-success-soft text-success"
                        : "bg-danger-soft text-destructive",
                    )}
                  >
                    {e.type === "income" ? "Entrada" : "Saída"}
                  </span>
                </td>
                <td
                  className={cn(
                    "px-2 py-3 text-right text-sm font-bold",
                    e.type === "income" ? "text-success" : "text-destructive",
                  )}
                >
                  {e.type === "income" ? "+" : "−"} {money(Number(e.value))}
                </td>
                <td className="px-2 py-3 text-right whitespace-nowrap">
                  <button
                    className="px-1.5 text-muted-foreground hover:text-primary-dark"
                    onClick={() => onEdit(e)}
                    aria-label="Editar"
                  >
                    ✎
                  </button>
                  <button
                    className="px-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm("Eliminar este lançamento em todos os dispositivos?"))
                        onDelete(e.id);
                    }}
                    aria-label="Eliminar"
                  >
                    ×
                  </button>
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
    entries
      .filter((e) => e.type === "expense")
      .forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + Number(e.value)));
    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [entries]);

  return (
    <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
      <div className="panel p-5">
        <h2 className="text-base font-semibold">Saídas por categoria</h2>
        <div className="mt-4 h-72">
          {byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Adicione saídas para ver os gastos por categoria.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip formatter={(v: number) => money(Number(v))} />
                <Bar dataKey="total" fill="var(--destructive)" radius={8} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="panel grid gap-5 p-5">
        <Summary label="Margem líquida" value={`${t.income ? Math.round((t.balance / t.income) * 100) : 0}%`} />
        <Summary
          label="Média por lançamento"
          value={money(entries.length ? (t.income + t.expense) / entries.length : 0)}
        />
        <Summary label="Número de movimentos" value={String(entries.length)} />
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function SettingsView({
  companyName,
  ownerName,
  email,
  saving,
  onSave,
  onSignOut,
}: {
  companyName: string;
  ownerName: string;
  email: string | null;
  saving: boolean;
  onSave: (patch: { company_name: string; owner_name: string }) => void;
  onSignOut: () => void;
}) {
  const [company, setCompany] = useState(companyName);
  const [owner, setOwner] = useState(ownerName);
  const { state, lastSyncedAt, pending } = useSync();

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="panel p-5">
        <h2 className="text-base font-semibold">Perfil</h2>
        <form
          className="mt-4 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ company_name: company.trim() || "O meu negócio", owner_name: owner.trim() });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="company">Nome do negócio</Label>
            <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="owner">Responsável</Label>
            <Input id="owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Conta</Label>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
          <Button type="submit" disabled={saving} className="justify-self-start">
            {saving ? "A guardar…" : "Guardar"}
          </Button>
        </form>
      </div>

      <div className="panel p-5">
        <h2 className="text-base font-semibold">Sincronização</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Todos os dados vivem na nuvem, na sua conta. Entre com o mesmo e-mail no iPhone e no
          computador para ver exatamente os mesmos lançamentos.
        </p>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Estado</dt>
            <dd>
              <SyncBadge />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Última sincronização</dt>
            <dd>{lastSyncedAt ? lastSyncedAt.toLocaleTimeString("pt-PT") : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Alterações por enviar</dt>
            <dd>{pending}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ligação em tempo real</dt>
            <dd>{state === "synced" ? "Ativa" : state === "offline" ? "Sem internet" : "A ligar"}</dd>
          </div>
        </dl>
        <Button variant="outline" className="mt-6" onClick={onSignOut}>
          Terminar sessão
        </Button>
      </div>
    </section>
  );
}

function exportCsv(entries: Entry[]) {
  const header = [
    "Tipo",
    "Valor",
    "Data",
    "Categoria",
    "Descrição",
    "Pagamento",
    "Cliente",
    "Observações",
  ];
  const rows = entries.map((e) =>
    [
      e.type === "income" ? "Entrada" : "Saída",
      e.value,
      e.entry_date,
      e.category,
      e.description,
      e.payment,
      e.client,
      e.notes,
    ]
      .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
      .join(";"),
  );
  const blob = new Blob([[header.join(";"), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lancamentos.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
