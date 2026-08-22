import { Link } from "@tanstack/react-router";
import { ArrowRight, Lightbulb, Sparkles } from "lucide-react";

import { buildFinanceInsights, type InsightTone } from "@/lib/ai-insights";
import type { Entry, Settings } from "@/lib/finance";
import { cn } from "@/lib/utils";

const toneClass: Record<InsightTone, string> = {
  positive: "border-emerald-500/25 bg-emerald-500/8",
  neutral: "border-border bg-card/60",
  caution: "border-amber-500/30 bg-amber-500/8",
  critical: "border-destructive/30 bg-destructive/8",
};

const toneDot: Record<InsightTone, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-muted-foreground",
  caution: "bg-amber-500",
  critical: "bg-destructive",
};

export function AiInsights({ entries, settings }: { entries: Entry[]; settings: Settings | null }) {
  const insights = buildFinanceInsights(entries, settings);
  return (
    <section className="panel panel-crown p-5 lg:p-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20"><Sparkles className="size-4" /></span>
          <div><h2 className="font-display text-base font-semibold">Insights Finance Flow AI</h2><p className="text-xs text-muted-foreground">Análise automática da margem, meta e categorias — com base nos seus lançamentos</p></div>
        </div>
        <Link to="/comando" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition hover:bg-muted">Central de Gestão <ArrowRight className="size-3.5" /></Link>
      </div>
      <ul className="mt-4 grid gap-3">
        {insights.map((item) => <li key={item.id} className={cn("rounded-xl border px-3.5 py-3", toneClass[item.tone])}><div className="flex items-start gap-2.5"><span className={cn("mt-1.5 size-2 shrink-0 rounded-full", toneDot[item.tone])} /><div className="min-w-0"><p className="text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>{item.tip ? <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-primary-dark"><Lightbulb className="mt-0.5 size-3.5 shrink-0" /><span>{item.tip}</span></p> : null}</div></div></li>)}
      </ul>
    </section>
  );
}
