import { useEffect, useState } from "react";
import { Brain, Cloud, Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Memory = {
  minimumCash: string;
  minimumMargin: string;
  hiringOccupancy: string;
  currentPriority: string;
};

const KEY = "financeflow.ceo.memory.v1";
const initial: Memory = { minimumCash: "10000", minimumMargin: "25", hiringOccupancy: "80", currentPriority: "Crescer com margem e preservar caixa" };

export function CeoOwnerMemory() {
  const [memory, setMemory] = useState<Memory>(initial);
  const [saved, setSaved] = useState(false);
  const [cloud, setCloud] = useState(false);

  useEffect(() => {
    let active = true;
    void (async()=>{
      try {
        const { data:{ user } } = await supabase.auth.getUser();
        if (!user || !active) return;
        const { data, error } = await (supabase as any).from("ceo_owner_memory").select("minimum_cash,minimum_margin,hiring_occupancy,current_priority").eq("user_id",user.id).maybeSingle();
        if (!error && data) {
          setMemory({ minimumCash:String(data.minimum_cash), minimumMargin:String(data.minimum_margin), hiringOccupancy:String(data.hiring_occupancy), currentPriority:data.current_priority ?? initial.currentPriority });
          setCloud(true); return;
        }
      } catch {}
      try { const raw = localStorage.getItem(KEY); if (raw && active) setMemory({ ...initial, ...JSON.parse(raw) }); } catch {}
    })();
    return()=>{active=false};
  }, []);

  async function save() {
    localStorage.setItem(KEY, JSON.stringify(memory));
    try {
      const { data:{ user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await (supabase as any).from("ceo_owner_memory").upsert({
          user_id:user.id,
          minimum_cash:Number(memory.minimumCash)||0,
          minimum_margin:Number(memory.minimumMargin)||0,
          hiring_occupancy:Number(memory.hiringOccupancy)||0,
          current_priority:memory.currentPriority,
          updated_at:new Date().toISOString(),
        },{onConflict:"user_id"});
        if (!error) setCloud(true);
      }
    } catch {}
    setSaved(true); window.setTimeout(() => setSaved(false), 1600);
  }

  return <section className="mt-5 panel p-5 lg:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Brain className="size-5"/></span><div><h2 className="font-display text-lg font-semibold">Memória do dono</h2><p className="mt-1 text-sm text-muted-foreground">Regras que o CEO AI deve considerar antes de recomendar decisões.</p></div></div>
      <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold">{cloud?<Cloud className="size-3.5 text-primary"/>:<ShieldCheck className="size-3.5 text-amber-500"/>}{cloud?"Sincronizado na cloud":"Fallback local ativo"}</span>
    </div>
    <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Field label="Caixa mínimo (€)" value={memory.minimumCash} onChange={v=>setMemory(m=>({...m,minimumCash:v}))}/>
      <Field label="Margem mínima (%)" value={memory.minimumMargin} onChange={v=>setMemory(m=>({...m,minimumMargin:v}))}/>
      <Field label="Ocupação para contratar (%)" value={memory.hiringOccupancy} onChange={v=>setMemory(m=>({...m,hiringOccupancy:v}))}/>
      <label className="grid gap-1.5 text-sm"><span className="font-medium">Prioridade atual</span><input className="rounded-xl border bg-background px-3 py-2.5" value={memory.currentPriority} onChange={e=>setMemory(m=>({...m,currentPriority:e.target.value}))}/></label>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">As regras ficam disponíveis em qualquer dispositivo quando a tabela cloud estiver aplicada.</p><button onClick={()=>void save()} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Save className="size-4"/>{saved?"Guardado":"Guardar regras"}</button></div>
  </section>;
}

function Field({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="grid gap-1.5 text-sm"><span className="font-medium">{label}</span><input inputMode="decimal" className="rounded-xl border bg-background px-3 py-2.5" value={value} onChange={e=>onChange(e.target.value)}/></label>}
