import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft, Bot, BrainCircuit, Calculator, CheckCircle2, ChevronRight, CircleHelp,
  Gauge, Goal, History, LockKeyhole, MessageCircle, PiggyBank, RefreshCw, ShieldCheck,
  Sparkles, Target, TrendingDown, TrendingUp, Wallet, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useEntries, useSettings } from "@/lib/data";
import type { Entry } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/finance-ai")({
  head: () => ({ meta: [{ title: "Finance AI | Finance Flow AI" }] }),
  component: FinanceAIRoute,
});

type Message = { role: "user" | "assistant"; content: string };
type Tab = "assistant" | "health" | "investments" | "goals" | "simulator";
type Risk = "conservador" | "moderado" | "dinamico";

type InvestorProfile = {
  risk: Risk;
  horizon: number;
  emergencyMonths: number;
  monthlyInvestment: number;
};

const PROFILE_KEY = "finance-ai-investor-profile-v1";

const starters = [
  "Analisa as minhas finanças e diz-me os 3 pontos mais importantes para melhorar.",
  "Quanto consigo poupar por mês com base nos meus lançamentos?",
  "Tenho dinheiro parado. Como devo pensar numa estratégia antes de investir?",
  "Quero chegar aos 50.000 €. Cria-me um plano por cenários.",
];

const investmentBuckets = [
  { title: "Reserva e liquidez", risk: "Muito baixo", color: "bg-emerald-500", text: "Prioridade quando ainda não existe uma almofada financeira suficiente. O foco é acesso ao dinheiro e estabilidade." },
  { title: "Rendimento fixo", risk: "Baixo a moderado", color: "bg-sky-500", text: "Instrumentos de dívida podem oferecer previsibilidade relativa, mas têm riscos de crédito, taxa, inflação e preço." },
  { title: "Carteiras diversificadas", risk: "Moderado", color: "bg-violet-500", text: "Diversificação pode reduzir risco específico, mas não elimina perdas nem volatilidade." },
  { title: "Ações", risk: "Elevado", color: "bg-orange-500", text: "Maior potencial de crescimento acompanhado de maior volatilidade e possibilidade de perdas significativas." },
];

function money(value: number) {
  return value.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function FinanceAIRoute() {
  const { userId } = useAuthUser();
  const { data: entries = [], isLoading: entriesLoading } = useEntries(userId);
  const { data: settings } = useSettings(userId);
  const [tab, setTab] = useState<Tab>("assistant");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá. Sou o Finance AI. Conheço os lançamentos financeiros que autorizaste e posso transformar esses dados em análises, cenários e próximos passos. Para investimentos, vou separar sempre educação, hipóteses e risco — sem prometer retornos." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<InvestorProfile>({ risk: "moderado", horizon: 10, emergencyMonths: 6, monthlyInvestment: 500 });
  const [profileOpen, setProfileOpen] = useState(false);
  const [goal, setGoal] = useState(50000);
  const [goalYears, setGoalYears] = useState(5);
  const [initialCapital, setInitialCapital] = useState(5000);
  const [inflation, setInflation] = useState(2);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      if (saved) setProfile({ ...profile, ...(JSON.parse(saved) as Partial<InvestorProfile>) });
    } catch { /* local preference only */ }
  }, []);

  function saveProfile(next: InvestorProfile) {
    setProfile(next);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  }

  const stats = useMemo(() => {
    const income = entries.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.value), 0);
    const expense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.value), 0);
    const balance = income - expense;
    const monthlyIncome = monthlyAverage(entries, "income");
    const monthlyExpense = monthlyAverage(entries, "expense");
    const savingsRate = monthlyIncome > 0 ? Math.max(0, (monthlyIncome - monthlyExpense) / monthlyIncome) : 0;
    const categories = categoryTotals(entries);
    const topExpense = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
    const monthsOfReserve = monthlyExpense > 0 ? Math.max(0, Math.min(24, Math.max(balance, 0) / monthlyExpense)) : 0;
    const health = healthScore({ savingsRate, monthsOfReserve, monthlyExpense, balance, entries: entries.length });
    return { income, expense, balance, monthlyIncome, monthlyExpense, savingsRate, categories, topExpense, monthsOfReserve, health };
  }, [entries]);

  const goalPlan = useMemo(() => {
    const months = Math.max(1, goalYears * 12);
    const monthlyNeeded = Math.max(0, (goal - initialCapital) / months);
    const conservative = futureValue(initialCapital, monthlyNeeded, 0.02, months);
    const moderate = futureValue(initialCapital, monthlyNeeded, 0.05, months);
    const dynamic = futureValue(initialCapital, monthlyNeeded, 0.08, months);
    return { months, monthlyNeeded, conservative, moderate, dynamic };
  }, [goal, goalYears, initialCapital]);

  const realValue = useMemo(() => {
    const years = Math.max(1, goalYears);
    return initialCapital / Math.pow(1 + inflation / 100, years);
  }, [goalYears, initialCapital, inflation]);

  async function send(text = input) {
    const question = text.trim();
    if (!question || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const response = await fetch("/api/finance-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ question, history: messages.slice(-8) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Não foi possível contactar o Finance AI.");
      setMessages((prev) => [...prev, { role: "assistant", content: body.answer ?? "Não consegui gerar uma resposta." }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: error instanceof Error ? error.message : "O Finance AI está temporariamente indisponível." }]);
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/painel" className="rounded-xl border p-2.5 hover:bg-muted" aria-label="Voltar"><ArrowLeft className="size-4" /></Link>
            <div>
              <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Sparkles className="size-4" /></span><span className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Finance Flow AI</span></div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">O teu copiloto financeiro</h1>
              <p className="mt-1 text-sm text-muted-foreground">Analisa. Simula. Planeia. Decide com mais contexto.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setProfileOpen(true)}><Target className="mr-2 size-4" /> Perfil de investimento</Button>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Gauge} label="Saúde financeira" value={`${stats.health}/100`} hint={healthLabel(stats.health)} />
          <Metric icon={Wallet} label="Resultado acumulado" value={money(stats.balance)} hint={`${entries.length} lançamentos analisados`} />
          <Metric icon={PiggyBank} label="Poupança média" value={`${Math.round(stats.savingsRate * 100)}%`} hint={`${money(Math.max(0, stats.monthlyIncome - stats.monthlyExpense))}/mês estimados`} />
          <Metric icon={ShieldCheck} label="Reserva estimada" value={`${stats.monthsOfReserve.toFixed(1)} meses`} hint="Com base nos lançamentos disponíveis" />
        </section>

        <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border bg-card p-1">
          {([
            ["assistant", "Assistente", MessageCircle], ["health", "Saúde", Gauge], ["investments", "Investimentos", TrendingUp], ["goals", "Objetivos", Goal], ["simulator", "Simulador", Calculator],
          ] as const).map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}><Icon className="size-4" />{label}</button>)}
        </nav>

        {tab === "assistant" && <Assistant messages={messages} input={input} setInput={setInput} loading={loading} send={send} />}
        {tab === "health" && <Health stats={stats} loading={entriesLoading} />}
        {tab === "investments" && <Investments profile={profile} onProfile={() => setProfileOpen(true)} />}
        {tab === "goals" && <Goals goal={goal} setGoal={setGoal} years={goalYears} setYears={setGoalYears} initial={initialCapital} setInitial={setInitialCapital} plan={goalPlan} />}
        {tab === "simulator" && <Simulator initial={initialCapital} setInitial={setInitialCapital} monthly={profile.monthlyInvestment} setMonthly={(v) => saveProfile({ ...profile, monthlyInvestment: v })} years={goalYears} setYears={setGoalYears} inflation={inflation} setInflation={setInflation} realValue={realValue} />}

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><p><strong>Proteção por design:</strong> o Finance AI não executa compras, vendas ou transferências. Cenários são hipóteses matemáticas e podem divergir bastante da realidade. Investimentos envolvem risco de perda de capital e produtos específicos devem ser avaliados com informação atualizada e, quando aplicável, por um profissional autorizado.</p></div>
      </div>
      {profileOpen && <ProfileModal profile={profile} onSave={(next) => { saveProfile(next); setProfileOpen(false); }} onClose={() => setProfileOpen(false)} />}
    </main>
  );
}

function Assistant({ messages, input, setInput, loading, send }: { messages: Message[]; input: string; setInput: (v: string) => void; loading: boolean; send: (v?: string) => Promise<void> }) {
  return <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
    <section className="panel flex min-h-[640px] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b p-5"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="size-5" /></span><div><p className="font-semibold">Finance AI</p><p className="text-xs text-muted-foreground">Análise financeira com contexto dos teus dados</p></div><span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="size-3" /> ONLINE</span></div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{message.content}</div></div>)}{loading && <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin" /> A analisar os teus dados…</div>}</div>
      <div className="border-t p-4"><div className="mb-3 flex flex-wrap gap-2">{starters.map((item) => <button key={item} onClick={() => void send(item)} disabled={loading} className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted disabled:opacity-50">{item}</button>)}</div><div className="flex gap-2"><Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Pergunta sobre as tuas finanças…" className="min-h-14 resize-none" /><Button onClick={() => void send()} disabled={loading || !input.trim()} className="self-end">Enviar</Button></div><p className="mt-2 text-[11px] text-muted-foreground">A IA usa os teus lançamentos autorizados para contextualizar a resposta. Não uses este chat para enviar palavras-passe ou dados bancários sensíveis.</p></div>
    </section>
    <aside className="space-y-4"><InfoCard icon={BrainCircuit} title="Perguntas inteligentes"><ul className="space-y-2 text-sm text-muted-foreground"><li>• “Onde estou a gastar mais?”</li><li>• “Quanto posso poupar?”</li><li>• “Posso assumir este gasto?”</li><li>• “Como preparo uma reserva?”</li><li>• “Explica-me este investimento.”</li></ul></InfoCard><InfoCard icon={LockKeyhole} title="Privacidade"><p className="text-sm leading-6 text-muted-foreground">A chave do motor de IA fica no servidor. O pedido é autenticado e os dados enviados para análise são limitados ao necessário.</p></InfoCard><InfoCard icon={History} title="Decisões melhores"><p className="text-sm leading-6 text-muted-foreground">Usa o histórico de lançamentos, objetivos e simuladores para transformar números em ações concretas.</p></InfoCard></aside>
  </div>;
}

function Health({ stats, loading }: { stats: ReturnType<typeof getStatsShape>; loading: boolean }) {
  const score = stats.health;
  const items = [
    ["Poupança", Math.min(100, Math.round(stats.savingsRate * 100 * 2)), stats.savingsRate >= 0.2 ? "Bom ritmo" : "Pode melhorar"],
    ["Reserva", Math.min(100, Math.round(stats.monthsOfReserve / 6 * 100)), stats.monthsOfReserve >= 6 ? "Almofada forte" : "Prioridade"],
    ["Resultado", stats.balance > 0 ? 80 : 25, stats.balance > 0 ? "Positivo" : "Atenção"],
    ["Consistência", Math.min(100, Math.round(stats.entries / 50 * 100)), stats.entries >= 20 ? "Boa base" : "Adiciona mais histórico"],
  ];
  return <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><section className="panel p-7 text-center"><p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Score financeiro</p><div className="mx-auto my-6 grid size-48 place-items-center rounded-full border-[14px] border-primary/15"><div><p className="text-5xl font-bold">{loading ? "—" : score}</p><p className="text-xs text-muted-foreground">de 100</p></div></div><p className="font-semibold">{healthLabel(score)}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">O score é uma ferramenta educativa baseada nos dados disponíveis, não uma avaliação bancária ou de crédito.</p></section><section className="panel p-6"><h2 className="text-xl font-bold">O que está a puxar o teu resultado</h2><div className="mt-6 space-y-6">{items.map(([label, value, hint]) => <div key={label as string}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{label}</span><span className="text-muted-foreground">{hint}</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value}%` }} /></div></div>)}<div className="rounded-2xl bg-muted/50 p-4"><p className="font-semibold">Primeiro passo recomendado</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{stats.monthsOfReserve < 3 ? "Constrói primeiro uma almofada de liquidez antes de aumentar o risco de investimento." : stats.savingsRate < 0.15 ? "Trabalha a taxa de poupança e identifica a maior categoria de despesa antes de aumentar o risco." : "A tua base parece mais preparada. Define um objetivo, prazo e tolerância ao risco antes de escolher instrumentos."}</p></div></div></section></div>;
}

function Investments({ profile, onProfile }: { profile: InvestorProfile; onProfile: () => void }) {
  return <div className="space-y-5"><section className="panel p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Mapa educativo</p><h2 className="mt-1 text-2xl font-bold">Onde cada tipo de risco pode fazer sentido</h2><p className="mt-1 text-sm text-muted-foreground">Não é uma lista de recomendações. É uma forma de pensar antes de escolher um produto.</p></div><Button variant="outline" onClick={onProfile}>Ajustar o meu perfil</Button></div><div className="mt-6 grid gap-4 md:grid-cols-2">{investmentBuckets.map((bucket) => <div key={bucket.title} className="rounded-2xl border p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`size-3 rounded-full ${bucket.color}`} /><h3 className="font-semibold">{bucket.title}</h3></div><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">{bucket.risk}</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{bucket.text}</p></div>)}</div></section><section className="grid gap-4 md:grid-cols-3"><InfoCard icon={ShieldCheck} title="Perfil atual"><p className="text-sm text-muted-foreground">Risco <strong>{profile.risk}</strong><br />Horizonte <strong>{profile.horizon} anos</strong><br />Liquidez de emergência <strong>{profile.emergencyMonths} meses</strong></p></InfoCard><InfoCard icon={CircleHelp} title="Antes de investir"><p className="text-sm leading-6 text-muted-foreground">Dívida cara, reserva insuficiente ou necessidade de usar o dinheiro em breve podem mudar completamente a decisão.</p></InfoCard><InfoCard icon={TrendingDown} title="Risco real"><p className="text-sm leading-6 text-muted-foreground">Mesmo carteiras diversificadas podem cair. O objetivo é alinhar o risco que tens com o risco que consegues suportar.</p></InfoCard></section></div>;
}

function Goals({ goal, setGoal, years, setYears, initial, setInitial, plan }: { goal: number; setGoal: (v: number) => void; years: number; setYears: (v: number) => void; initial: number; setInitial: (v: number) => void; plan: { monthlyNeeded: number; conservative: number; moderate: number; dynamic: number } }) {
  return <section className="panel p-6 lg:p-8"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Goal className="size-5" /></span><div><h2 className="text-2xl font-bold">Plano para o teu objetivo</h2><p className="text-sm text-muted-foreground">Calcula quanto precisarias de colocar de lado sem tratar retorno como garantia.</p></div></div><div className="mt-7 grid gap-4 md:grid-cols-3"><Field label="Objetivo (€)" value={goal} onChange={setGoal} /><Field label="Prazo (anos)" value={years} onChange={setYears} /><Field label="Capital inicial (€)" value={initial} onChange={setInitial} /></div><div className="mt-8 rounded-2xl bg-primary/5 p-6"><p className="text-sm text-muted-foreground">Sem assumir qualquer retorno, precisarias de aproximadamente</p><p className="mt-1 text-4xl font-bold">{money(plan.monthlyNeeded)}<span className="text-base font-medium text-muted-foreground"> / mês</span></p><p className="mt-2 text-xs text-muted-foreground">para cobrir a diferença entre o capital inicial e o objetivo no prazo escolhido.</p></div><div className="mt-6 grid gap-4 md:grid-cols-3"><Scenario label="Hipótese 2% a.a." value={plan.conservative} /><Scenario label="Hipótese 5% a.a." value={plan.moderate} /><Scenario label="Hipótese 8% a.a." value={plan.dynamic} /></div></section>;
}

function Simulator({ initial, setInitial, monthly, setMonthly, years, setYears, inflation, setInflation, realValue }: { initial: number; setInitial: (v: number) => void; monthly: number; setMonthly: (v: number) => void; years: number; setYears: (v: number) => void; inflation: number; setInflation: (v: number) => void; realValue: number }) {
  const months = Math.max(1, years * 12);
  const scenarios = [0.02, 0.05, 0.08].map((rate) => ({ rate, value: futureValue(initial, monthly, rate, months) }));
  return <section className="panel p-6 lg:p-8"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Calculator className="size-5" /></span><div><h2 className="text-2xl font-bold">Simulador financeiro</h2><p className="text-sm text-muted-foreground">Testa capital, aportes, prazo e inflação em segundos.</p></div></div><div className="mt-7 grid gap-4 md:grid-cols-4"><Field label="Capital (€)" value={initial} onChange={setInitial} /><Field label="Aporte mensal (€)" value={monthly} onChange={setMonthly} /><Field label="Prazo (anos)" value={years} onChange={setYears} /><Field label="Inflação hipotética (%)" value={inflation} onChange={setInflation} /></div><div className="mt-8 grid gap-4 md:grid-cols-3">{scenarios.map((s) => <Scenario key={s.rate} label={`${s.rate * 100}% a.a. — hipótese`} value={s.value} />)}</div><div className="mt-6 grid gap-4 md:grid-cols-2"><div className="rounded-2xl border p-5"><p className="text-sm font-semibold">Valor real do capital inicial</p><p className="mt-2 text-2xl font-bold">{money(realValue)}</p><p className="mt-1 text-xs text-muted-foreground">Exemplo do poder de compra após {years} anos com inflação hipotética de {inflation}%.</p></div><div className="rounded-2xl border p-5"><p className="text-sm font-semibold">Total colocado por ti</p><p className="mt-2 text-2xl font-bold">{money(initial + monthly * months)}</p><p className="mt-1 text-xs text-muted-foreground">Sem contar ganhos, perdas, impostos, comissões ou inflação.</p></div></div></section>;
}

function ProfileModal({ profile, onSave, onClose }: { profile: InvestorProfile; onSave: (p: InvestorProfile) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(profile);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl border bg-background p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Perfil de investimento</p><h2 className="mt-1 text-2xl font-bold">Personaliza a análise</h2></div><button onClick={onClose} className="rounded-xl p-2 hover:bg-muted"><X className="size-5" /></button></div><p className="mt-2 text-sm leading-6 text-muted-foreground">Este perfil serve para contextualizar explicações e cenários. Não constitui uma recomendação de investimento.</p><div className="mt-6 space-y-5"><label className="block text-sm font-semibold">Tolerância ao risco<select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={draft.risk} onChange={(e) => setDraft({ ...draft, risk: e.target.value as Risk })}><option value="conservador">Conservador</option><option value="moderado">Moderado</option><option value="dinamico">Dinâmico</option></select></label><Field label="Horizonte (anos)" value={draft.horizon} onChange={(v) => setDraft({ ...draft, horizon: v })} /><Field label="Reserva desejada (meses de despesas)" value={draft.emergencyMonths} onChange={(v) => setDraft({ ...draft, emergencyMonths: v })} /><Field label="Aporte mensal pretendido (€)" value={draft.monthlyInvestment} onChange={(v) => setDraft({ ...draft, monthlyInvestment: v })} /></div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => onSave(draft)}>Guardar perfil</Button></div></div></div>;
}

function Metric({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string }) { return <div className="panel p-4"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /><span className="text-xs font-semibold">{label}</span></div><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{hint}</p></div>; }
function InfoCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) { return <div className="panel p-5"><div className="flex items-center gap-2"><Icon className="size-4 text-primary" /><h3 className="font-semibold">{title}</h3></div><div className="mt-3">{children}</div></div>; }
function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) { return <label className="text-sm font-semibold">{label}<Input type="number" min="0" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className="mt-2" /></label>; }
function Scenario({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border bg-card p-5"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{money(value)}</p><p className="mt-1 text-[11px] text-muted-foreground">Hipótese matemática, não previsão.</p></div>; }
function futureValue(initial: number, monthly: number, annualRate: number, months: number) { const r = annualRate / 12; return r === 0 ? initial + monthly * months : initial * Math.pow(1 + r, months) + monthly * ((Math.pow(1 + r, months) - 1) / r); }
function monthlyAverage(entries: Entry[], type: Entry["type"]) { const values = entries.filter((e) => e.type === type); if (!values.length) return 0; const dates = values.map((e) => new Date(e.entry_date).getTime()).filter(Number.isFinite); if (!dates.length) return 0; const months = Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 30) + 1); return values.reduce((s, e) => s + Number(e.value), 0) / months; }
function categoryTotals(entries: Entry[]) { return entries.filter((e) => e.type === "expense").reduce<Record<string, number>>((acc, e) => { const key = e.category || "Sem categoria"; acc[key] = (acc[key] ?? 0) + Number(e.value); return acc; }, {}); }
function healthScore(data: { savingsRate: number; monthsOfReserve: number; monthlyExpense: number; balance: number; entries: number }) { return Math.max(0, Math.min(100, Math.round(data.savingsRate * 45 + Math.min(data.monthsOfReserve / 6, 1) * 35 + (data.balance >= 0 ? 15 : 0) + Math.min(data.entries / 50, 1) * 5))); }
function healthLabel(score: number) { if (score >= 80) return "Muito saudável"; if (score >= 65) return "Saudável"; if (score >= 45) return "A melhorar"; return "Precisa de atenção"; }
type Stats = ReturnType<typeof calculateStats>;
type getStatsShape = Stats;
function calculateStats(entries: Entry[]) { const income = entries.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.value), 0); const expense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.value), 0); const balance = income - expense; const monthlyIncome = monthlyAverage(entries, "income"); const monthlyExpense = monthlyAverage(entries, "expense"); const savingsRate = monthlyIncome > 0 ? Math.max(0, (monthlyIncome - monthlyExpense) / monthlyIncome) : 0; const categories = categoryTotals(entries); const topExpense = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]; const monthsOfReserve = monthlyExpense > 0 ? Math.max(0, Math.min(24, Math.max(balance, 0) / monthlyExpense)) : 0; const health = healthScore({ savingsRate, monthsOfReserve, monthlyExpense, balance, entries: entries.length }); return { income, expense, balance, monthlyIncome, monthlyExpense, savingsRate, categories, topExpense, monthsOfReserve, health, entries: entries.length }; }
