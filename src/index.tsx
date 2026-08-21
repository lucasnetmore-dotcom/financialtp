import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Search,
  Users,
  Wallet,
  Star,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";

import { BrandName } from "@/components/BrandName";
import { SyncBadge } from "@/components/SyncBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser, useEntries } from "@/lib/data";
import {
  buildClientsFromEntries,
  CRM_STATUS_LABELS,
  type ClientStatus,
  type CrmClient,
} from "@/lib/crm";
import { formatDate, money } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/clientes/")({
  component: ClientesPage,
});

const statusColor: Record<ClientStatus, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  vip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  inactive: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

function ClientesPage() {
  const { userId } = useAuthUser();
  const { data: entries = [], isLoading } = useEntries(userId);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all">("all");

  const clients = useMemo(() => buildClientsFromEntries(entries), [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q);
    });
  }, [clients, search, statusFilter]);

  const totals = useMemo(() => {
    return {
      totalClients: clients.length,
      totalIncome: clients.reduce((s, c) => s + c.total_income, 0),
      vip: clients.filter((c) => c.status === "vip").length,
      leads: clients.filter((c) => c.status === "lead").length,
    };
  }, [clients]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandName />
            <nav className="hidden items-center gap-1 sm:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/painel">
                  <LayoutDashboard className="mr-1.5 h-4 w-4" />
                  Painel
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link to="/clientes">
                  <Users className="mr-1.5 h-4 w-4" />
                  Clientes
                </Link>
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <SyncBadge />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes (CRM)</h1>
          <p className="text-sm text-muted-foreground">
            Clientes extraídos automaticamente dos lançamentos. Preencha o campo
            “Cliente” ao criar uma entrada para aparecer aqui.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard icon={Users} label="Total clientes" value={String(totals.totalClients)} />
          <SummaryCard icon={Wallet} label="Receita total" value={money(totals.totalIncome)} />
          <SummaryCard icon={Star} label="VIP" value={String(totals.vip)} />
          <SummaryCard icon={UserPlus} label="Leads" value={String(totals.leads)} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ClientStatus | "all")}
          >
            <option value="all">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="lead">Lead</option>
            <option value="vip">VIP</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {clients.length === 0
                ? "Ainda não há clientes. No painel, ao criar um lançamento, preencha o campo Cliente."
                : "Nenhum cliente corresponde à pesquisa."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Receita</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">1º contacto</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Última</th>
                    <th className="px-4 py-3 font-medium text-right">Lançamentos</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c: CrmClient) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          to="/clientes/$clientId"
                          params={{ clientId: c.id }}
                          className="font-medium hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[c.status]}`}
                        >
                          {CRM_STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {money(c.total_income)}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                        {formatDate(c.first_contact_date)}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {c.last_entry_date ? formatDate(c.last_entry_date) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">{c.entries_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
