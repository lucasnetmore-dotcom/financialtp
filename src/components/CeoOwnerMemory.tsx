import { useEffect, useState } from "react";
import { Brain, Save, ShieldCheck } from "lucide-react";

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

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setMemory({ ...initial, ...JSON.parse(raw) }); } catch {}
  }, []);

  function save() {
    localStorage.setItem(KEY, JSON.stringify(memory));
    setSaved(true); window.setTimeout(() => setSaved(false), 1600);
  }

  return <section className="mt-5 panel p-5 lg:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Brain className="size-5"/></span><div><h2 className="font-display text-lg font-semibold">Memória do dono</h2><p className="mt-1 text-sm text-muted-foreground">Regras que o CEO AI deve considerar antes de recomendar decisões.</p></div></div>
      <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"><ShieldCheck className="size-3.5 text-emerald-500"/>Só neste dispositivo por enquanto</span>
    </div>
    <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Field label="Caixa mínimo (€)" value={memory.minimumCash} onChange={v=>setMemory(m=>({...m,minimumCash:v}))}/>
      <Field label="Margem mínima (%)" value={memory.minimumMargin} onChange={v=>setMemory(m=>({...m,minimumMargin:v}))}/>
      <Field label="Ocupação para contratar (%)" value={memory.hiringOccupancy} onChange={v=>setMemory(m=>({...m,hiringOccupancy:v}))}/>
      <label className="grid gap-1.5 text-sm"><span className="font-medium">Prioridade atual</span><input className="rounded-xl border bg-background px-3 py-2.5" value={memory.currentPriority} onChange={e=>setMemory(m=>({...m,currentPriority:e.target.value}))}/></label>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Próxima fase: guardar estas regras na cloud e usá-las diretamente nas decisões e alertas do CEO AI.</p><button onClick={save} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Save className="size-4"/>{saved?"Guardado":"Guardar regras"}</button></div>
  </section>;
}

function Field({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="grid gap-1.5 text-sm"><span className="font-medium">{label}</span><input inputMode="decimal" className="rounded-xl border bg-background px-3 py-2.5" value={value} onChange={e=>onChange(e.target.value)}/></label>}
