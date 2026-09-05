import { useEffect, useMemo, useState } from "react";
import { Bot, BrainCircuit, CalendarDays, Send, ShieldCheck, Sparkles, Target, TrendingUp, TriangleAlert, Users } from "lucide-react";
import type { Entry, Settings } from "@/lib/finance";
import { buildFinanceInsights } from "@/lib/ai-insights";
import { supabase } from "@/integrations/supabase/client";

const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const ym = (d: Date) => d.toISOString().slice(0, 7);
type Client = { id:string; name:string; created_at:string };
type Appointment = { id:string; client_id:string; starts_at:string; status:string; title:string };

function monthTotals(entries: Entry[], month: string) {
  const rows = entries.filter(e => e.entry_date.slice(0, 7) === month);
  const income = rows.filter(e => e.type === "income").reduce((s, e) => s + Number(e.value), 0);
  const expense = rows.filter(e => e.type === "expense").reduce((s, e) => s + Number(e.value), 0);
  return { income, expense, balance: income - expense };
}

export function CeoAi({ entries, settings }: { entries: Entry[]; settings: Settings | null }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Pergunte sobre faturação, lucro, custos, clientes, agenda, meta ou evolução do negócio.");
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  useEffect(() => { let active = true; void Promise.all([
    supabase.from("clients").select("id,name,created_at"),
    supabase.from("appointments").select("id,client_id,starts_at,status,title"),
  ]).then(([c,a])=>{ if(!active)return; if(!c.error)setClients((c.data??[]) as Client[]); if(!a.error)setAppointments((a.data??[]) as Appointment[]); }); return()=>{active=false}; }, []);

  const data = useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const current = monthTotals(entries, ym(now));
    const previous = monthTotals(entries, ym(prev));
    const days = Math.max(1, now.getDate());
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projected = current.income / days * totalDays;
    const delta = previous.income ? ((current.income - previous.income) / previous.income) * 100 : 0;
    const margin = current.income ? current.balance / current.income * 100 : 0;
    const goal = Number(settings?.monthly_goal ?? 0);
    return { current, previous, projected, delta, margin, goal };
  }, [entries, settings]);

  const crm = useMemo(()=>{
    const now=Date.now(), d30=30*86400000, d60=60*86400000;
    const valid=appointments.filter(a=>a.status!=="cancelled");
    const completed=valid.filter(a=>a.status==="completed"||new Date(a.starts_at).getTime()<now);
    const upcoming=valid.filter(a=>new Date(a.starts_at).getTime()>=now);
    const lastByClient=new Map<string,number>(); const countByClient=new Map<string,number>();
    for(const a of completed){const t=new Date(a.starts_at).getTime();lastByClient.set(a.client_id,Math.max(lastByClient.get(a.client_id)??0,t));countByClient.set(a.client_id,(countByClient.get(a.client_id)??0)+1)}
    const inactive60=clients.filter(c=>{const t=lastByClient.get(c.id);return !!t&&now-t>d60}).length;
    const active30=clients.filter(c=>{const t=lastByClient.get(c.id);return !!t&&now-t<=d30}).length;
    const recurring=[...countByClient.values()].filter(n=>n>=2).length;
    const recurrence=clients.length?recurring/clients.length*100:0;
    const next7=upcoming.filter(a=>new Date(a.starts_at).getTime()<=now+7*86400000).length;
    return { total:clients.length, inactive60, active30, recurring, recurrence, next7, upcoming:upcoming.length };
  },[clients,appointments]);

  const insights = useMemo(() => buildFinanceInsights(entries, settings), [entries, settings]);
  const businessPriorities = useMemo(()=>{
    const out=[...insights];
    if(crm.inactive60>=5) out.unshift({id:"inactive-clients",tone:"caution" as const,title:`${crm.inactive60} clientes sem retorno há 60+ dias`,body:"Há uma base de clientes com histórico que pode merecer uma ação de reativação.",tip:"Revise estes clientes no CRM antes de investir mais em aquisição."});
    if(crm.total>=5&&crm.recurrence<30) out.unshift({id:"low-recurrence",tone:"caution" as const,title:"Recorrência de clientes baixa",body:`Apenas cerca de ${crm.recurrence.toFixed(0)}% dos clientes têm 2 ou mais atendimentos registados.`,tip:"Priorize retenção, próxima marcação e acompanhamento pós-serviço."});
    if(crm.next7===0&&crm.total>0) out.unshift({id:"empty-week",tone:"caution" as const,title:"Próximos 7 dias sem marcações",body:"A agenda não mostra atendimentos futuros para a próxima semana.",tip:"Considere uma ação de recuperação de clientes ou campanha para preencher a agenda."});
    return out.slice(0,5);
  },[insights,crm]);

  function ask(q = question) {
    const text = q.trim().toLowerCase(); if (!text) return;
    let a = `Este mês entram ${eur.format(data.current.income)}, saem ${eur.format(data.current.expense)} e o resultado está em ${eur.format(data.current.balance)}.`;
    if (/cliente|recorr|inativ|retorn/.test(text)) a = `O CRM tem ${crm.total} clientes. ${crm.active30} tiveram atendimento nos últimos 30 dias e ${crm.inactive60} estão sem retorno há mais de 60 dias. A recorrência registada está em cerca de ${crm.recurrence.toFixed(0)}%.`;
    else if (/agenda|hor[aá]rio|marca[cç][aã]o|semana/.test(text)) a = `Há ${crm.upcoming} marcações futuras e ${crm.next7} nos próximos 7 dias. ${crm.next7===0 ? "A próxima semana está sem marcações registadas; eu trataria preenchimento de agenda como prioridade." : "A agenda já tem atividade futura registada; vale acompanhar ocupação por dia e horário na próxima evolução."}`;
    else if (/lucro|margem|resultado/.test(text)) a = `O resultado do mês está em ${eur.format(data.current.balance)}, com margem aproximada de ${data.margin.toFixed(1)}%. ${data.margin < 10 ? "A margem está apertada; eu priorizaria revisão de custos antes de assumir novas despesas fixas." : "A margem está positiva; ainda assim, valide caixa e recorrência antes de aumentar custos fixos."}`;
    else if (/m[eê]s passado|compar|evolu/.test(text)) a = data.previous.income ? `As entradas estão ${Math.abs(data.delta).toFixed(1)}% ${data.delta >= 0 ? "acima" : "abaixo"} do mês passado nesta leitura. Mês atual: ${eur.format(data.current.income)}; mês anterior completo: ${eur.format(data.previous.income)}.` : "Ainda não há dados suficientes do mês anterior para uma comparação útil.";
    else if (/fim do m[eê]s|proje|fatur/.test(text)) a = `Mantido o ritmo atual, a projeção simples de entradas para o fim do mês é ${eur.format(data.projected)}. É uma projeção de ritmo, não uma garantia.`;
    else if (/meta/.test(text)) a = data.goal > 0 ? `A meta configurada é ${eur.format(data.goal)}. Já foram registados ${eur.format(data.current.income)}; faltam ${eur.format(Math.max(0, data.goal - data.current.income))}.` : "Ainda não existe uma meta mensal configurada. Defina uma para eu acompanhar ritmo e desvio automaticamente.";
    else if (/gasto|custo|despesa/.test(text)) a = `As saídas registadas neste mês somam ${eur.format(data.current.expense)}. Também monitorizo concentrações por categoria e aumentos fora do padrão quando há dados suficientes.`;
    setAnswer(a); setQuestion("");
  }

  const prompts = ["Como estou vs mês passado?", "Como está a agenda?", "Tenho clientes inativos?", "Como está minha margem?"];
  return <section className="mt-5 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
    <div className="border-b border-border/70 p-5 lg:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-primary"><BrainCircuit className="size-5"/><span className="eyebrow">CEO AI · Beta</span></div><h2 className="mt-2 text-2xl font-bold tracking-tight">Financeiro + clientes + agenda, numa só leitura.</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">O CEO AI já cruza os lançamentos do Finance Flow com dados do CRM e da agenda para encontrar prioridades e responder perguntas com mais contexto.</p></div><span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-2 text-xs font-semibold"><ShieldCheck className="size-4 text-emerald-500"/>Baseado nos seus dados</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="Entradas do mês" value={eur.format(data.current.income)} icon={TrendingUp}/><Metric label="Resultado" value={eur.format(data.current.balance)} icon={Target}/><Metric label="Margem" value={`${data.margin.toFixed(1)}%`} icon={Sparkles}/><Metric label="Clientes" value={String(crm.total)} icon={Users}/><Metric label="Inativos 60d+" value={String(crm.inactive60)} icon={Users}/><Metric label="Próx. 7 dias" value={String(crm.next7)} icon={CalendarDays}/></div>
    </div>
    <div className="grid lg:grid-cols-[.9fr_1.1fr]"><div className="border-b border-border/70 p-5 lg:border-b-0 lg:border-r lg:p-7"><div className="flex items-center gap-2"><TriangleAlert className="size-4 text-amber-500"/><h3 className="font-semibold">Prioridades detectadas</h3></div><div className="mt-4 grid gap-3">{businessPriorities.map(i=><div key={i.id} className="rounded-2xl border bg-background/60 p-4"><p className="text-sm font-semibold">{i.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.body}</p>{i.tip&&<p className="mt-2 text-xs font-medium text-primary">→ {i.tip}</p>}</div>)}</div></div>
      <div className="p-5 lg:p-7"><div className="flex items-center gap-2"><Bot className="size-5 text-primary"/><h3 className="font-semibold">Pergunte ao CEO AI</h3></div><div className="mt-4 min-h-28 rounded-2xl border bg-background/70 p-4 text-sm leading-relaxed">{answer}</div><div className="mt-3 flex flex-wrap gap-2">{prompts.map(p=><button key={p} onClick={()=>ask(p)} className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted">{p}</button>)}</div><div className="mt-4 flex gap-2"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')ask()}} placeholder="Ex.: tenho clientes para recuperar?" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"/><button onClick={()=>ask()} className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Send className="size-4"/></button></div><p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Esta versão interpreta dados internos. Ainda não envia mensagens, altera agenda nem movimenta dinheiro automaticamente.</p></div>
    </div>
  </section>;
}
function Metric({label,value,icon:Icon}:{label:string;value:string;icon:React.ComponentType<{className?:string}>}){return <div className="rounded-2xl border bg-background/65 p-4"><Icon className="size-4 text-primary"/><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tracking-tight">{value}</p></div>}
