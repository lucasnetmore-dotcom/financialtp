import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BellRing, CalendarDays, CircleDollarSign, Sparkles, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { BusinessGrowthCenter } from "@/components/BusinessGrowthCenter";
import { BusinessOverviewPro } from "@/components/BusinessOverviewPro";
import { CeoAi } from "@/components/CeoAi";
import { Button } from "@/components/ui/button";
import { useAuthUser, useEntries, useSettings } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/comando")({
  head: () => ({ meta: [{ title: "CEO AI | Finance Flow AI" }] }),
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
          <div><div className="flex items-center gap-2 text-primary"><Sparkles className="size-4" /><span className="eyebrow">Finance Flow AI</span></div><h1 className="mt-1 text-3xl font-bold tracking-tight">CEO AI</h1><p className="mt-1 text-sm text-muted-foreground">O centro inteligente que interpreta os dados da sua empresa e ajuda a decidir o próximo passo.</p></div>
        </div>
      </header>

      {isLoading ? <div className="panel h-52 animate-pulse" /> : <BusinessOverviewPro entries={entries} settings={settings ?? null} />}
      {!isLoading && <CeoAi entries={entries} settings={settings ?? null} />}

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <ActionCard icon={BellRing} title="Notificações inteligentes" body="Alertas automáticos sobre saldo, gastos fora do padrão, meta mensal, categorias e atividade do negócio." to="/painel" cta="Ver painel" />
        <ActionCard icon={Users} title="CRM + Clientes" body="Acompanha clientes, histórico financeiro, recorrência e relacionamento num único banco de dados." to="/crm" cta="Abrir CRM" />
        <ActionCard icon={CalendarDays} title="Agenda" body="Organiza marcações, clientes e serviços dentro do CRM sem separar os dados do financeiro." to="/crm" cta="Abrir agenda" />
      </section>

      <BusinessGrowthCenter
        userId={userId}
        entries={entries}
        onFinanceChanged={() => void queryClient.invalidateQueries({ queryKey: ["entries", userId] })}
      />

      <section className="mt-5 panel p-5 lg:p-6">
        <div className="flex items-center gap-2"><CircleDollarSign className="size-5 text-primary" /><h2 className="font-display text-lg font-semibold">Como o CEO AI evolui</h2></div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {[['1','Vê','Financeiro, CRM e agenda alimentam o contexto.'],['2','Interpreta','Compara, projeta e encontra anomalias.'],['3','Recomenda','Prioriza decisões com impacto no caixa e crescimento.'],['4','Pede autorização','Ações relevantes ficam sob seu controlo.'],['5','Executa','Campanhas, cobranças e rotinas entram nas próximas fases.']].map(([n,t,b])=><div key={n} className="rounded-2xl border bg-muted/20 p-4"><span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span><p className="mt-3 font-semibold">{t}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{b}</p></div>)}
        </div>
      </section>
    </div>
  </main>;
}

function ActionCard({ icon: Icon, title, body, to, cta }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; to: "/painel" | "/crm"; cta: string }) {
  return <div className="panel p-5"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><h2 className="mt-4 font-display text-lg font-semibold">{title}</h2><p className="mt-2 min-h-12 text-sm leading-relaxed text-muted-foreground">{body}</p><Button asChild variant="outline" className="mt-4 w-full"><Link to={to}>{cta}</Link></Button></div>;
}
