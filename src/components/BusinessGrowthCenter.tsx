import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CircleDollarSign, RefreshCw, Sparkles, TrendingUp, UserRoundCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Entry } from "@/lib/finance";

const SERVICES: Record<string, number> = {
  "Corte": 60,
  "Madeixas": 180,
  "Iluminado": 130,
  "Coloração completa": 70,
  "Avaliação para madeixas": 30,
  "Avaliação para extensões": 15,
};

type Client = { id: string; name: string; email: string | null; phone: string | null; created_at: string };
type Appointment = { id: string; client_id: string; title: string; starts_at: string; ends_at: string | null; status: string; notes: string | null };

type Props = { userId: string | null; entries: Entry[]; onFinanceChanged?: () => void };

const eur = (n: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86400000);
const dateOnly = (v: string) => v.slice(0, 10);
const isDeposit = (e: Entry) => e.type === "income" && (e.category || "").trim().toLowerCase() === "sinal";

export function BusinessGrowthCenter({ userId, entries, onFinanceChanged }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    const [c, a] = await Promise.all([
      supabase.from("clients").select("id,name,email,phone,created_at").order("name"),
      supabase.from("appointments").select("id,client_id,title,starts_at,ends_at,status,notes").order("starts_at"),
    ]);
    if (c.error || a.error) toast.error("Não foi possível carregar a inteligência de clientes e agenda.");
    setClients((c.data ?? []) as Client[]);
    setAppointments((a.data ?? []) as Appointment[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [userId]);

  const data = useMemo(() => {
    const now = new Date();
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const incomeEntries = entries.filter((e) => e.type === "income");

    const clientSpend = new Map<string, number>();
    for (const e of incomeEntries) {
      const key = (e.client || "").trim().toLowerCase();
      if (key) clientSpend.set(key, (clientSpend.get(key) ?? 0) + Number(e.value));
    }

    const upcoming = appointments.filter((a) => a.status !== "cancelled" && new Date(a.starts_at) >= now && new Date(a.starts_at) <= in30);
    const forecast = upcoming.reduce((sum, a) => sum + (SERVICES[a.title] ?? 0), 0);

    const completed = appointments.filter((a) => a.status === "completed" || (a.status !== "cancelled" && new Date(a.starts_at) < now));
    const serviceRevenue = new Map<string, number>();
    for (const a of completed) serviceRevenue.set(a.title, (serviceRevenue.get(a.title) ?? 0) + (SERVICES[a.title] ?? 0));
    const topServices = [...serviceRevenue.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const lastTouch = new Map<string, Date>();
    for (const a of completed) {
      const d = new Date(a.starts_at);
      const prev = lastTouch.get(a.client_id);
      if (!prev || d > prev) lastTouch.set(a.client_id, d);
    }

    const atRisk = clients
      .map((c) => ({ client: c, last: lastTouch.get(c.id), spent: clientSpend.get(c.name.trim().toLowerCase()) ?? 0 }))
      .filter((x) => x.last && daysBetween(now, x.last) >= 60)
      .sort((a, b) => (b.spent - a.spent) || ((a.last?.getTime() ?? 0) - (b.last?.getTime() ?? 0)))
      .slice(0, 8);

    const topClients = clients
      .map((c) => ({ client: c, spent: clientSpend.get(c.name.trim().toLowerCase()) ?? 0 }))
      .filter((x) => x.spent > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 6);

    const paidAppointmentIds = new Set(entries.map((e) => e.notes || "").filter(Boolean).flatMap((n) => {
      const m = n.match(/appointment:([a-zA-Z0-9-]+)/); return m ? [m[1]] : [];
    }));

    const pendingReceipts = completed
      .filter((a) => (SERVICES[a.title] ?? 0) > 0 && !paidAppointmentIds.has(a.id))
      .map((a) => ({ appointment: a, client: clientMap.get(a.client_id), price: SERVICES[a.title] ?? 0 }))
      .filter((x) => x.client)
      .sort((a, b) => +new Date(b.appointment.starts_at) - +new Date(a.appointment.starts_at))
      .slice(0, 10);

    const totalCustomerRevenue = [...clientSpend.values()].reduce((s, v) => s + v, 0);
    // SINAL is real revenue and stays in the numerator, but it is not a separate service/ticket.
    // Example: €50 SINAL + €50 final payment = €100 revenue / 1 completed ticket = €100 average ticket.
    const completedTicketEntries = incomeEntries.filter((e) => !isDeposit(e));
    const avgTicket = completedTicketEntries.length ? totalCustomerRevenue / completedTicketEntries.length : 0;
    const openDeposits = incomeEntries.filter(isDeposit).length;
    const recurring = clients.filter((c) => completed.filter((a) => a.client_id === c.id).length >= 2).length;
    const recurrence = clients.length ? recurring / clients.length : 0;

    return { upcoming, forecast, topServices, atRisk, topClients, pendingReceipts, avgTicket, openDeposits, recurrence };
  }, [clients, appointments, entries]);

  async function registerReceipt(item: { appointment: Appointment; client?: Client; price: number }) {
    if (!userId || !item.client || paying) return;
    setPaying(item.appointment.id);
    const payload = {
      id: crypto.randomUUID(),
      user_id: userId,
      type: "income",
      value: item.price,
      entry_date: dateOnly(item.appointment.starts_at),
      category: "Serviços",
      description: item.appointment.title,
      payment: "Outro",
      client: item.client.name,
      notes: `Recebimento criado a partir da Agenda · appointment:${item.appointment.id}`,
    };
    const { error } = await supabase.from("entries").upsert(payload as never, { onConflict: "id" });
    if (error) toast.error("Não foi possível registrar o recebimento.");
    else {
      toast.success(`${eur(item.price)} registrados no financeiro para ${item.client.name}.`);
      onFinanceChanged?.();
    }
    setPaying(null);
  }

  if (loading) return <section className="panel h-52 animate-pulse" />;

  return <section className="mt-5 space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><div className="flex items-center gap-2 text-primary"><Sparkles className="size-4" /><span className="eyebrow">Negócio conectado</span></div><h2 className="mt-1 font-display text-xl font-semibold">CRM + Agenda + Financeiro</h2><p className="mt-1 text-sm text-muted-foreground">A agenda deixa de ser só calendário: passa a prever receita, identificar clientes em risco e alimentar o caixa.</p></div>
      <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 size-4" />Atualizar</Button>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={CalendarClock} label="Receita prevista 30 dias" value={eur(data.forecast)} hint={`${data.upcoming.length} marcações futuras`} />
      <Metric icon={CircleDollarSign} label="Ticket médio" value={eur(data.avgTicket)} hint={data.openDeposits ? `Sinais incluídos no valor · ${data.openDeposits} sinal(is) sem contar como novo ticket` : "Sinais entram no valor sem criar um novo ticket"} />
      <Metric icon={UserRoundCheck} label="Recorrência" value={`${Math.round(data.recurrence * 100)}%`} hint="Clientes com 2+ atendimentos" />
      <Metric icon={AlertTriangle} label="Clientes em risco" value={String(data.atRisk.length)} hint="Sem atendimento há 60+ dias" />
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Recebimentos pendentes" subtitle="Marcações concluídas que ainda não geraram lançamento financeiro.">
        {data.pendingReceipts.length === 0 ? <Empty text="Nenhum recebimento pendente detectado." /> : <div className="space-y-2">{data.pendingReceipts.map((x) => <div key={x.appointment.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{x.client?.name}</p><p className="text-xs text-muted-foreground">{x.appointment.title} · {new Date(x.appointment.starts_at).toLocaleDateString("pt-PT")}</p></div><div className="flex items-center gap-3"><strong className="text-sm">{eur(x.price)}</strong><Button size="sm" disabled={paying === x.appointment.id} onClick={() => void registerReceipt(x)}>{paying === x.appointment.id ? "A registrar…" : "Registrar"}</Button></div></div>)}</div>}
      </Panel>

      <Panel title="Clientes para recuperar" subtitle="Prioriza quem já gerou receita e está há mais tempo sem voltar.">
        {data.atRisk.length === 0 ? <Empty text="Nenhum cliente importante em risco neste momento." /> : <div className="space-y-2">{data.atRisk.map((x) => <div key={x.client.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-semibold">{x.client.name}</p><p className="text-xs text-muted-foreground">Última visita há {x.last ? daysBetween(new Date(), x.last) : 0} dias</p></div><div className="text-right"><strong className="text-sm">{eur(x.spent)}</strong><p className="text-[11px] text-muted-foreground">valor histórico</p></div></div>)}</div>}
      </Panel>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Clientes de maior valor" subtitle="Quem mais faturou contigo até agora.">
        {data.topClients.length === 0 ? <Empty text="Associe clientes aos lançamentos para gerar este ranking." /> : <div className="space-y-2">{data.topClients.map((x, i) => <div key={x.client.id} className="flex items-center justify-between rounded-xl bg-muted/35 px-3 py-2.5"><div className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span><span className="text-sm font-semibold">{x.client.name}</span></div><strong className="text-sm">{eur(x.spent)}</strong></div>)}</div>}
      </Panel>

      <Panel title="Serviços que mais geram valor" subtitle="Estimativa pelo catálogo atual e histórico de marcações.">
        {data.topServices.length === 0 ? <Empty text="Conclua marcações para criar o ranking de serviços." /> : <div className="space-y-3">{data.topServices.map(([name, revenue], i) => { const max = data.topServices[0]?.[1] || 1; return <div key={name}><div className="flex justify-between gap-3 text-sm"><span className="font-medium">{name}</span><strong>{eur(revenue)}</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, revenue / max * 100)}%` }} /></div></div>; })}</div>}
      </Panel>
    </div>

    <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 text-sm"><div className="flex items-start gap-3"><TrendingUp className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-semibold">O ciclo agora fica conectado</p><p className="mt-1 leading-6 text-muted-foreground">Cliente → marcação → serviço → recebimento → lançamento financeiro → histórico do cliente → previsão e alertas. Isso reduz lançamento duplicado e transforma a agenda numa ferramenta de gestão.</p></div></div></div>
  </section>;
}

function Metric({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string }) {
  return <div className="panel p-4"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span></div><p className="mt-4 text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{hint}</p></div>;
}
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <div className="panel p-5"><h3 className="font-display text-base font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p><div className="mt-4">{children}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-2 size-5 opacity-50" />{text}</div>; }
