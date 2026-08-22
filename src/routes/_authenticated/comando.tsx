import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BrainCircuit, CalendarDays, CircleDollarSign, Sparkles, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { BusinessGrowthCenter } from "@/components/BusinessGrowthCenter";
import { BusinessOverviewPro } from "@/components/BusinessOverviewPro";
import { Button } from "@/components/ui/button";
import { useAuthUser, useEntries, useSettings } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/comando")({
  head: () => ({ meta: [{ title: "Central de Gestão | Finance Flow AI" }] }),
  component: CommandCenter,
});

function CommandCenter() {
  const { userId } = useAuthUser();
  const queryClient = useQueryClient();
  const { data: entries = [], isLoading } = useEntries(userId);
  const { data: settings } = useSettings(userId);

  return <main className="min-h-screen bg-background px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/painel" className="rounded-xl border p-2.5 hover:bg-muted" aria-label="Voltar"><ArrowLeft className="size-4" /></Link>
          <div><div className="flex items-center gap-2 text-primary"><Sparkles className="size-4" /><span className="eyebrow">Finance Flow AI</span></div><h1 className="mt-1 text-3xl font-bold tracking-tight">Central de Gestão</h1><p className="mt-1 text-sm text-muted-foreground">Financeiro, clientes, agenda e IA a trabalhar como um único sistema.</p></div>
        </div>
      </header>

      {isLoading ? <div className="panel h-52 animate-pulse" /> : <BusinessOverviewPro entries={entries} settings={settings ?? null} />}

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <ActionCard icon={BrainCircuit} title="Finance AI" body="Pergunta sobre caixa, despesas, objetivos e cenários com contexto dos teus próprios dados." to="/finance-ai" cta="Abrir copiloto" />
        <ActionCard icon={Users} title="CRM + Clientes" body="Acompanha clientes, histórico financeiro, recorrência e relacionamento num único banco de dados." to="/crm" cta="Abrir CRM" />
        <ActionCard icon={CalendarDays} title="Agenda" body="Organiza marcações, clientes e serviços dentro do CRM sem separar os dados do financeiro." to="/crm" cta="Abrir agenda" />
      </section>

      <BusinessGrowthCenter
        userId={userId}
        entries={entries}
        onFinanceChanged={() => void queryClient.invalidateQueries({ queryKey: ["entries", userId] })}
      />

      <section className="mt-5 panel p-5 lg:p-6">
        <div className="flex items-center gap-2"><CircleDollarSign className="size-5 text-primary" /><h2 className="font-display text-lg font-semibold">Fluxo inteligente do Finance Flow</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {[['1','Regista','Entradas e saídas alimentam todo o sistema.'],['2','Relaciona','Associa clientes aos lançamentos e marcações.'],['3','Atende','A agenda regista serviço, horário e cliente.'],['4','Recebe','Transforma o atendimento em receita com um clique.'],['5','Decide','Alertas e Finance AI usam todo o contexto para orientar a gestão.']].map(([n,t,b])=><div key={n} className="rounded-2xl border bg-muted/20 p-4"><span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span><p className="mt-3 font-semibold">{t}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{b}</p></div>)}
        </div>
      </section>
    </div>
  </main>;
}

function ActionCard({ icon: Icon, title, body, to, cta }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; to: "/finance-ai" | "/crm"; cta: string }) {
  return <div className="panel p-5"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><h2 className="mt-4 font-display text-lg font-semibold">{title}</h2><p className="mt-2 min-h-12 text-sm leading-relaxed text-muted-foreground">{body}</p><Button asChild variant="outline" className="mt-4 w-full"><Link to={to}>{cta}</Link></Button></div>;
}
