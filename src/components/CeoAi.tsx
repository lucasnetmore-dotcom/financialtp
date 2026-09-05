import { useEffect, useMemo, useState } from "react";
import { Bot, BrainCircuit, CalendarDays, Send, ShieldCheck, Sparkles, Target, TrendingUp, TriangleAlert, Users } from "lucide-react";
import type { Entry, Settings } from "@/lib/finance";
import { buildFinanceInsights } from "@/lib/ai-insights";
import { supabase } from "@/integrations/supabase/client";

const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const ym = (d: Date) => d.toISOString().slice(0, 7);
type Client = { id:string; name:string; created_at:string };
type Appointment = { id:string; client_id:string; starts_at:string; status:string; title:string };
type OwnerMemory = { minimum_cash:number; minimum_margin:number; hiring_occupancy:number; current_priority:string };
const memoryFallback:OwnerMemory={minimum_cash:10000,minimum_margin:25,hiring_occupancy:80,current_priority:"Crescer com margem e preservar caixa"};

function monthTotals(entries: Entry[], month: string) {
  const rows = entries.filter(e => e.entry_date.slice(0, 7) === month);
  const income = rows.filter(e => e.type === "income").reduce((s, e) => s + Number(e.value), 0);
  const expense = rows.filter(e => e.type === "expense").reduce((s, e) => s + Number(e.value), 0);
  return { income, expense, balance: income - expense };
}

function extractAmount(text:string){
  const normalized=text.replace(/\./g,"").replace(",",".");
  const match=normalized.match(/(?:€\s*)?(\d+(?:\.\d+)?)(?:\s*€)?/);
  return match?Number(match[1]):null;
}

export function CeoAi({ entries, settings }: { entries: Entry[]; settings: Settings | null }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Pergunte sobre faturação, lucro, custos, clientes, agenda, meta, contratação ou investimentos.");
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [ownerMemory,setOwnerMemory]=useState<OwnerMemory>(memoryFallback);
  useEffect(() => { let active = true; void Promise.all([
    supabase.from("clients").select("id,name,created_at"),
    supabase.from("appointments").select("id,client_id,starts_at,status,title"),
    supabase.from("ceo_owner_memory").select("minimum_cash,minimum_margin,hiring_occupancy,current_priority").maybeSingle(),
  ]).then(([c,a,m])=>{ if(!active)return; if(!c.error)setClients((c.data??[]) as Client[]); if(!a.error)setAppointments((a.data??[]) as Appointment[]); if(!m.error&&m.data)setOwnerMemory({minimum_cash:Number(m.data.minimum_cash??memoryFallback.minimum_cash),minimum_margin:Number(m.data.minimum_margin??memoryFallback.minimum_margin),hiring_occupancy:Number(m.data.hiring_occupancy??memoryFallback.hiring_occupancy),current_priority:String(m.data.current_priority??memoryFallback.current_priority)}); else {try{const raw=localStorage.getItem("financeflow.ceo.memory.v1");if(raw){const x=JSON.parse(raw);setOwnerMemory({minimum_cash:Number(x.minimumCash??memoryFallback.minimum_cash),minimum_margin:Number(x.minimumMargin??memoryFallback.minimum_margin),hiring_occupancy:Number(x.hiringOccupancy??memoryFallback.hiring_occupancy),current_priority:String(x.currentPriority??memoryFallback.current_priority)})}}catch{}} }); return()=>{active=false}; }, []);

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
    const historicalBalance=entries.reduce((s,e)=>s+(e.type==="income"?Number(e.value):-Number(e.value)),0);
    return { current, previous, projected, delta, margin, goal, historicalBalance };
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
    const occupancyProxy=Math.min(100,next7/14*100);
    return { total:clients.length, inactive60, active30, recurring, recurrence, next7, upcoming:upcoming.length, occupancyProxy };
  },[clients,appointments]);

  const insights = useMemo(() => buildFinanceInsights(entries, settings), [entries, settings]);
  const businessPriorities = useMemo(()=>{
    const out=[...insights];
    if(data.margin<ownerMemory.minimum_margin) out.unshift({id:"owner-margin",tone:"caution" as const,title:`Margem abaixo da regra definida (${ownerMemory.minimum_margin}%)`,body:`A margem atual está em ${data.margin.toFixed(1)}%.`,tip:"Evite aumentar custos fixos até recuperar a margem desejada."});
    if(data.historicalBalance<ownerMemory.minimum_cash) out.unshift({id:"owner-cash",tone:"caution" as const,title:"Caixa abaixo da reserva mínima",body:`Saldo financeiro aproximado: ${eur.format(data.historicalBalance)}. Reserva definida: ${eur.format(ownerMemory.minimum_cash)}.`,tip:"Priorize preservar caixa antes de novos investimentos."});
    if(crm.inactive60>=5) out.unshift({id:"inactive-clients",tone:"caution" as const,title:`${crm.inactive60} clientes sem retorno há 60+ dias`,body:"Há uma base de clientes com histórico que pode merecer uma ação de reativação.",tip:"Revise estes clientes no CRM antes de investir mais em aquisição."});
    if(crm.total>=5&&crm.recurrence<30) out.unshift({id:"low-recurrence",tone:"caution" as const,title:"Recorrência de clientes baixa",body:`Apenas cerca de ${crm.recurrence.toFixed(0)}% dos clientes têm 2 ou mais atendimentos registados.`,tip:"Priorize retenção, próxima marcação e acompanhamento pós-serviço."});
    if(crm.next7===0&&crm.total>0) out.unshift({id:"empty-week",tone:"caution" as const,title:"Próximos 7 dias sem marcações",body:"A agenda não mostra atendimentos futuros para a próxima semana.",tip:"Considere uma ação de recuperação de clientes ou campanha para preencher a agenda."});
    return out.slice(0,5);
  },[insights,crm,data,ownerMemory]);

  function ask(q = question) {
    const text = q.trim().toLowerCase(); if (!text) return;
    const amount=extractAmount(text);
    let a = `Este mês entram ${eur.format(data.current.income)}, saem ${eur.format(data.current.expense)} e o resultado está em ${eur.format(data.current.balance)}. Prioridade definida: ${ownerMemory.current_priority}.`;
    if (/comprar|investir|m[aá]quina|equipamento|gastar|desembols/.test(text)) {
      if(amount!==null){const after=data.historicalBalance-amount;const respectsCash=after>=ownerMemory.minimum_cash;const respectsMargin=data.margin>=ownerMemory.minimum_margin;a=`Se o gasto for ${eur.format(amount)}, o saldo aproximado passaria de ${eur.format(data.historicalBalance)} para ${eur.format(after)}. Sua regra é manter pelo menos ${eur.format(ownerMemory.minimum_cash)} de caixa e margem mínima de ${ownerMemory.minimum_margin}%. Hoje a margem está em ${data.margin.toFixed(1)}%. ${respectsCash&&respectsMargin?"Pelos critérios que você definiu, a decisão cabe dentro das regras atuais. Ainda vale validar retorno esperado e prazo de payback antes de executar.":`Pelas regras que você definiu, eu não recomendaria executar agora${!respectsCash?" porque furaria a reserva mínima de caixa":""}${!respectsCash&&!respectsMargin?" e":""}${!respectsMargin?" porque a margem está abaixo do mínimo desejado":""}.`}`}
      else a=`Para avaliar um investimento, diga o valor. Vou comparar com sua reserva mínima de ${eur.format(ownerMemory.minimum_cash)}, margem mínima de ${ownerMemory.minimum_margin}% e prioridade atual: ${ownerMemory.current_priority}.`;
    }
    else if (/contrat|funcion[aá]rio|cabeleireir|barbeir|colaborador/.test(text)) a=`Sua regra é considerar contratação a partir de ${ownerMemory.hiring_occupancy}% de ocupação. Usando a agenda dos próximos 7 dias como proxy simples, a ocupação está em cerca de ${crm.occupancyProxy.toFixed(0)}%. ${crm.occupancyProxy>=ownerMemory.hiring_occupancy?"A demanda começa a justificar analisar uma contratação, mas confirme rentabilidade por profissional e capacidade real antes de decidir.":"Eu ainda não trataria contratação como prioridade. Primeiro tentaria elevar ocupação e recorrência sem aumentar custo fixo."}`;
    else if (/cliente|recorr|inativ|retorn/.test(text)) a = `O CRM tem ${crm.total} clientes. ${crm.active30} tiveram atendimento nos últimos 30 dias e ${crm.inactive60} estão sem retorno há mais de 60 dias. A recorrência registada está em cerca de ${crm.recurrence.toFixed(0)}%.`;
    else if (/agenda|hor[aá]rio|marca[cç][aã]o|semana/.test(text)) a = `Há ${crm.upcoming} marcações futuras e ${crm.next7} nos próximos 7 dias. ${crm.next7===0 ? "A próxima semana está sem marcações registadas; eu trataria preenchimento de agenda como prioridade." : "A agenda já tem atividade futura registada; vale acompanhar ocupação por dia e horário."}`;
    else if (/lucro|margem|resultado/.test(text)) a = `O resultado do mês está em ${eur.format(data.current.balance)}, com margem aproximada de ${data.margin.toFixed(1)}%. Sua regra mínima é ${ownerMemory.minimum_margin}%. ${data.margin<ownerMemory.minimum_margin?"A margem está abaixo do limite que você definiu; eu evitaria aumentar custos fixos agora.":"A margem está acima do mínimo definido; ainda assim, preserve a reserva de caixa antes de expandir custos."}`;
    else if (/caixa|reserva|saldo/.test(text)) a=`O saldo financeiro aproximado com base nos lançamentos é ${eur.format(data.historicalBalance)}. Sua reserva mínima definida é ${eur.format(ownerMemory.minimum_cash)}. ${data.historicalBalance>=ownerMemory.minimum_cash?"A reserva está preservada.":`Faltam cerca de ${eur.format(ownerMemory.minimum_cash-data.historicalBalance)} para voltar ao nível mínimo definido.`}`;
    else if (/m[eê]s passado|compar|evolu/.test(text)) a = data.previous.income ? `As entradas estão ${Math.abs(data.delta).toFixed(1)}% ${data.delta >= 0 ? "acima" : "abaixo"} do mês passado nesta leitura. Mês atual: ${eur.format(data.current.income)}; mês anterior completo: ${eur.format(data.previous.income)}.` : "Ainda não há dados suficientes do mês anterior para uma comparação útil.";
    else if (/fim do m[eê]s|proje|fatur/.test(text)) a = `Mantido o ritmo atual, a projeção simples de entradas para o fim do mês é ${eur.format(data.projected)}. É uma projeção de ritmo, não uma garantia.`;
    else if (/meta/.test(text)) a = data.goal > 0 ? `A meta configurada é ${eur.format(data.goal)}. Já foram registados ${eur.format(data.current.income)}; faltam ${eur.format(Math.max(0, data.goal - data.current.income))}.` : "Ainda não existe uma meta mensal configurada. Defina uma para eu acompanhar ritmo e desvio automaticamente.";
    else if (/gasto|custo|despesa/.test(text)) a = `As saídas registadas neste mês somam ${eur.format(data.current.expense)}. Também considero sua regra de caixa mínimo de ${eur.format(ownerMemory.minimum_cash)} e margem mínima de ${ownerMemory.minimum_margin}% antes de recomendar novos gastos.`;
    setAnswer(a); setQuestion("");
  }

  const prompts = ["Posso investir €7.000 agora?", "Já posso contratar alguém?", "Como está minha reserva de caixa?", "Como está minha margem?"];
  return <section className="mt-5 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
    <div className="border-b border-border/70 p-5 lg:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-primary"><BrainCircuit className="size-5"/><span className="eyebrow">CEO AI · Beta</span></div><h2 className="mt-2 text-2xl font-bold tracking-tight">Decisões com contexto e regras do dono.</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">O CEO AI cruza financeiro, CRM, agenda e as regras que você definiu para avaliar gastos, margem, caixa, contratação e crescimento.</p></div><span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-2 text-xs font-semibold"><ShieldCheck className="size-4 text-emerald-500"/>Usa suas regras</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Metric label="Entradas do mês" value={eur.format(data.current.income)} icon={TrendingUp}/><Metric label="Saldo aprox." value={eur.format(data.historicalBalance)} icon={Target}/><Metric label="Margem" value={`${data.margin.toFixed(1)}%`} icon={Sparkles}/><Metric label="Clientes" value={String(crm.total)} icon={Users}/><Metric label="Inativos 60d+" value={String(crm.inactive60)} icon={Users}/><Metric label="Próx. 7 dias" value={String(crm.next7)} icon={CalendarDays}/></div>
    </div>
    <div className="grid lg:grid-cols-[.9fr_1.1fr]"><div className="border-b border-border/70 p-5 lg:border-b-0 lg:border-r lg:p-7"><div className="flex items-center gap-2"><TriangleAlert className="size-4 text-amber-500"/><h3 className="font-semibold">Prioridades detectadas</h3></div><div className="mt-4 grid gap-3">{businessPriorities.map(i=><div key={i.id} className="rounded-2xl border bg-background/60 p-4"><p className="text-sm font-semibold">{i.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.body}</p>{i.tip&&<p className="mt-2 text-xs font-medium text-primary">→ {i.tip}</p>}</div>)}</div></div>
      <div className="p-5 lg:p-7"><div className="flex items-center gap-2"><Bot className="size-5 text-primary"/><h3 className="font-semibold">Pergunte ao CEO AI</h3></div><div className="mt-4 min-h-28 rounded-2xl border bg-background/70 p-4 text-sm leading-relaxed">{answer}</div><div className="mt-3 flex flex-wrap gap-2">{prompts.map(p=><button key={p} onClick={()=>ask(p)} className="rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted">{p}</button>)}</div><div className="mt-4 flex gap-2"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')ask()}} placeholder="Ex.: posso comprar uma máquina de €7.000?" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"/><button onClick={()=>ask()} className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Send className="size-4"/></button></div><p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">As recomendações são apoio à decisão com base nos dados registados e nas regras definidas; não substituem análise contabilística ou financeira profissional.</p></div>
    </div>
  </section>;
}
function Metric({label,value,icon:Icon}:{label:string;value:string;icon:React.ComponentType<{className?:string}>}){return <div className="rounded-2xl border bg-background/65 p-4"><Icon className="size-4 text-primary"/><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tracking-tight">{value}</p></div>}
