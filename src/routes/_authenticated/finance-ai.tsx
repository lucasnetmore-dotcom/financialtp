import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, BrainCircuit, Calculator, ChevronRight, ShieldCheck, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/finance-ai")({
  head: () => ({ meta: [{ title: "Finance AI | Finance Flow AI" }] }),
  component: FinanceAIRoute,
});

type Message = { role: "user" | "assistant"; content: string };

const starters = [
  "Tenho dinheiro parado. Como posso organizar uma estratégia segura antes de investir?",
  "Quanto consigo poupar por mês com base nas minhas finanças?",
  "Quero chegar a 50.000 €. Que cenários devo considerar?",
  "Explica-me a diferença entre depósito, obrigação, ETF e ação.",
];

function FinanceAIRoute() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Olá. Sou o Finance AI. Posso analisar a tua situação financeira, explicar investimentos, comparar cenários e ajudar-te a tomar decisões com mais segurança. Não executo compras ou vendas e não prometo rendimentos.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"chat" | "simulator">("chat");
  const [amount, setAmount] = useState("5000");
  const [monthly, setMonthly] = useState("500");
  const [years, setYears] = useState("10");

  const scenarios = useMemo(() => {
    const p = Number(amount) || 0;
    const m = Number(monthly) || 0;
    const y = Math.max(1, Number(years) || 1);
    const n = y * 12;
    return [0.02, 0.05, 0.08].map((rate) => ({
      rate,
      value: p * Math.pow(1 + rate / 12, n) + m * ((Math.pow(1 + rate / 12, n) - 1) / (rate / 12)),
    }));
  }, [amount, monthly, years]);

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/painel" className="rounded-xl border p-2.5 hover:bg-muted" aria-label="Voltar"><ArrowLeft className="size-4" /></Link>
            <div>
              <div className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /><span className="eyebrow">Finance Flow AI</span></div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Finance AI</h1>
              <p className="mt-1 text-sm text-muted-foreground">O teu copiloto financeiro, ligado aos dados do teu negócio.</p>
            </div>
          </div>
          <div className="flex rounded-xl border bg-card p-1">
            <button onClick={() => setMode("chat")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Assistente</button>
            <button onClick={() => setMode("simulator")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "simulator" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Simulador</button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="panel p-4"><ShieldCheck className="size-5 text-primary" /><p className="mt-2 font-semibold">Primeiro segurança</p><p className="mt-1 text-xs text-muted-foreground">Reserva, liquidez e capacidade financeira antes do risco.</p></div>
          <div className="panel p-4"><BrainCircuit className="size-5 text-primary" /><p className="mt-2 font-semibold">Contexto real</p><p className="mt-1 text-xs text-muted-foreground">As respostas podem usar os teus dados financeiros autorizados.</p></div>
          <div className="panel p-4"><TrendingUp className="size-5 text-primary" /><p className="mt-2 font-semibold">Cenários, não promessas</p><p className="mt-1 text-xs text-muted-foreground">Simulações são hipóteses e não garantias de retorno.</p></div>
        </div>

        {mode === "chat" ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_310px]">
            <section className="panel flex min-h-[650px] flex-col overflow-hidden">
              <div className="flex items-center gap-3 border-b p-5"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="size-5" /></span><div><p className="font-semibold">Finance AI</p><p className="text-xs text-muted-foreground">Educação financeira e análise personalizada</p></div></div>
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {messages.map((message, index) => <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{message.content}</div></div>)}
                {loading && <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">A analisar os teus dados…</div>}
              </div>
              <div className="border-t p-4"><div className="mb-3 flex flex-wrap gap-2">{starters.map((item) => <button key={item} onClick={() => void send(item)} className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">{item}</button>)}</div><div className="flex gap-2"><Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Pergunta sobre as tuas finanças ou investimentos…" className="min-h-14 resize-none" /><Button onClick={() => void send()} disabled={loading || !input.trim()} className="self-end">Enviar</Button></div><p className="mt-2 text-[11px] text-muted-foreground">Informação geral e educativa. Não é aconselhamento financeiro personalizado nem garantia de retorno.</p></div>
            </section>
            <aside className="space-y-4"><div className="panel p-5"><div className="flex items-center gap-2"><Wallet className="size-4 text-primary" /><h2 className="font-semibold">O que posso fazer</h2></div><ul className="mt-4 space-y-3 text-sm text-muted-foreground"><li>• analisar receitas e despesas</li><li>• calcular capacidade de poupança</li><li>• explicar produtos financeiros</li><li>• comparar risco, liquidez e horizonte</li><li>• criar cenários de objetivos</li><li>• identificar sinais de pressão financeira</li></ul></div><div className="panel p-5"><p className="font-semibold">Próximo nível</p><p className="mt-2 text-sm text-muted-foreground">O Finance AI foi preparado para evoluir para metas, alertas, memória financeira e automações com aprovação humana.</p><ChevronRight className="mt-3 size-4 text-primary" /></div></aside>
          </div>
        ) : (
          <section className="panel p-6 lg:p-8"><div className="flex items-center gap-2"><Calculator className="size-5 text-primary" /><h2 className="text-xl font-bold">Simulador de crescimento</h2></div><p className="mt-1 text-sm text-muted-foreground">Exemplo matemático. Não representa uma previsão nem promessa de rendimento.</p><div className="mt-6 grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Capital inicial<input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" className="mt-2 h-10 w-full rounded-md border bg-background px-3" /></label><label className="text-sm font-medium">Aporte mensal<input value={monthly} onChange={(e) => setMonthly(e.target.value)} type="number" min="0" className="mt-2 h-10 w-full rounded-md border bg-background px-3" /></label><label className="text-sm font-medium">Prazo (anos)<input value={years} onChange={(e) => setYears(e.target.value)} type="number" min="1" max="60" className="mt-2 h-10 w-full rounded-md border bg-background px-3" /></label></div><div className="mt-8 grid gap-4 md:grid-cols-3">{scenarios.map((scenario) => <div key={scenario.rate} className="rounded-2xl border bg-muted/30 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hipótese {scenario.rate * 100}% a.a.</p><p className="mt-2 text-2xl font-bold">{scenario.value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}</p><p className="mt-2 text-xs text-muted-foreground">Valor matemático estimado com capitalização mensal.</p></div>)}</div></section>
        )}
      </div>
    </main>
  );
}
