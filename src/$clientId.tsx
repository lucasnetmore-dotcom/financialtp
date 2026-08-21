import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, LayoutDashboard, Users, Wallet } from "lucide-react";
import { useMemo } from "react";

import { BrandName } from "@/components/BrandName";
import { SyncBadge } from "@/components/SyncBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuthUser, useEntries } from "@/lib/data";
import {
  buildClientsFromEntries,
  CRM_STATUS_LABELS,
  findClientById,
  getClientEntries,
  type ClientStatus,
} from "@/lib/crm";
import { formatDate, money, totals } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/clientes/$clientId")({
  component: ClientDetailPage,
});

const statusColor: Record<ClientStatus, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  vip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  inactive: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const { userId } = useAuthUser();
  const { data: entries = [], isLoading } = useEntries(userId);

  const clients = useMemo(() => buildClientsFromEntries(entries), [entries]);
  const client = useMemo(() => findClientById(clients, clientId), [clients, clientId]);
  const clientEntries = useMemo(
    () => (client ? getClientEntries(entries, client.name) : []),
    [entries, client],
  );
  const summary = useMemo(() => totals(clientEntries), [clientEntries]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        A carregar...
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Button asChild>
          <Link to="/clientes">Voltar aos clientes</Link>
        </Button>
      </div>
    );
  }

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
        <Button variant="ghost" size="sm" asChild>
          <Link to="/clientes">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Clientes
          </Link>
        </Button>

        <div className="rounded-xl border bg-card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[client.status]}`}
            >
              {CRM_STATUS_LABELS[client.status]}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              1º contacto: {formatDate(client.first_contact_date)}
            </div>
            {client.last_entry_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Última movimentação: {formatDate(client.last_entry_date)}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-medium">Receita deste cliente</span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              {money(summary.income)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground">Despesas associadas</div>
            <p className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">
              {money(summary.expense)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-medium text-muted-foreground">Lançamentos</div>
            <p className="mt-1 text-2xl font-semibold">{clientEntries.length}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <div className="border-b bg-muted/40 px-4 py-3 font-medium">Histórico de lançamentos</div>
          {clientEntries.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Sem lançamentos.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/20">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-medium">Data</th>
                    <th className="px-4 py-2.5 font-medium">Tipo</th>
                    <th className="px-4 py-2.5 font-medium">Descrição</th>
                    <th className="px-4 py-2.5 font-medium">Categoria</th>
                    <th className="px-4 py-2.5 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {clientEntries.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {formatDate(e.entry_date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={
                            e.type === "income"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {e.type === "income" ? "Receita" : "Despesa"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{e.description || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.category}</td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {money(Number(e.value))}
                      </td>
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
