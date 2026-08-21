import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { OnboardingGate } from "@/components/OnboardingGate";
import { supabase } from "@/integrations/supabase/client";
import { getEffectivePlan } from "@/lib/billing.functions";

const LEGAL_VERSION = "2026-08-21";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { modo: "entrar" } });
    if (location.pathname === "/crm") {
      let plan = "free";
      try {
        const result = await getEffectivePlan();
        plan = result.plan ?? "free";
      } catch {
        // Fail closed: an unverified billing state must never unlock paid CRM access.
        plan = "free";
      }
      if (plan !== "pro" && plan !== "business") throw redirect({ to: "/planos" });
    }
    return { user: data.user };
  },
  component: () => {
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    const inCrm = pathname === "/crm";
    const [canAccessCrm, setCanAccessCrm] = useState(false);
    const [legalAccepted, setLegalAccepted] = useState<boolean | null>(null);
    const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

    useEffect(() => {
      let active = true;
      void supabase.auth.getUser().then(({ data }) => {
        if (!active) return;
        const meta = data.user?.user_metadata ?? {};
        setLegalAccepted(meta.legal_consent === true && meta.legal_consent_version === LEGAL_VERSION);
        setOnboardingDone(meta.onboarding_completed === true);
      });
      void getEffectivePlan().then((result) => {
        if (active) setCanAccessCrm(result.plan === "pro" || result.plan === "business");
      }).catch(() => {
        if (active) setCanAccessCrm(false);
      });
      return () => { active = false; };
    }, [pathname]);

    async function acceptLegal() {
      const { error } = await supabase.auth.updateUser({ data: { legal_consent: true, legal_consent_version: LEGAL_VERSION, legal_consent_at: new Date().toISOString() } });
      if (error) { toast.error(error.message); return; }
      setLegalAccepted(true);
    }

    if (legalAccepted === null || onboardingDone === null) return <div className="min-h-screen bg-background" />;
    if (!legalAccepted) return <LegalConsentGate onAccept={acceptLegal} />;
    if (!onboardingDone) return <OnboardingGate onComplete={() => setOnboardingDone(true)} />;

    return <><Outlet />{inCrm && <Link to="/painel" aria-label="Voltar para lançamentos e caixa" className="fixed left-3 top-3 z-[100] inline-flex items-center gap-2 rounded-xl border-2 border-primary/30 bg-background px-4 py-3 text-sm font-bold text-foreground shadow-xl ring-1 ring-black/5 backdrop-blur transition-all hover:bg-primary hover:text-primary-foreground sm:left-5 sm:top-5"><ArrowLeft className="size-5"/><span className="hidden sm:inline">VOLTAR PARA LANÇAMENTOS E CAIXA</span><span className="sm:hidden">VOLTAR</span></Link>}{!inCrm&&<><Link to={canAccessCrm?"/crm":"/planos"} aria-label="CRM / Agenda" className="fixed bottom-5 left-5 z-50 hidden w-[236px] items-center gap-2.5 rounded-xl border border-border/70 bg-sidebar px-4 py-3 text-sm font-semibold text-sidebar-foreground shadow-lg ring-1 ring-black/5 backdrop-blur transition-all hover:bg-sidebar-accent lg:flex"><CalendarDays className={canAccessCrm?"size-4 text-primary":"size-4 text-muted-foreground"}/>CRM / Agenda {!canAccessCrm&&<LockKeyhole className="ml-auto size-3.5 text-muted-foreground"/>}</Link><Link to={canAccessCrm?"/crm":"/planos"} aria-label="Agenda" className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground lg:hidden"><CalendarDays className="size-4"/>Agenda {!canAccessCrm&&<LockKeyhole className="size-3.5"/>}</Link></>}</>;
  },
});

function LegalConsentGate({ onAccept }: { onAccept: () => Promise<void> }) {
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const accept = async () => { if (!accepted) return; setSaving(true); try { await onAccept(); } finally { setSaving(false); } };
  return <main className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-background px-5 py-8"><section className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl sm:p-8"><p className="eyebrow">Finance Flow AI</p><h1 className="mt-2 text-2xl font-bold">Antes de continuar</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Para utilizar o Finance Flow AI, precisa de ler e aceitar os documentos legais. Sem este consentimento, o acesso à aplicação fica bloqueado.</p><div className="mt-5 grid gap-2"><Link to="/termos-de-utilizacao" target="_blank" className="rounded-xl border p-4 text-sm font-semibold hover:bg-muted">Ler Termos de Utilização →</Link><Link to="/politica-de-privacidade" target="_blank" className="rounded-xl border p-4 text-sm font-semibold hover:bg-muted">Ler Política de Privacidade →</Link></div><label className="mt-5 flex items-start gap-3 rounded-xl border bg-muted/20 p-4 text-sm leading-6"><input type="checkbox" className="mt-1 size-4" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>Li e aceito os Termos de Utilização e a Política de Privacidade do Finance Flow AI.</span></label><button disabled={!accepted||saving} onClick={()=>void accept()} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{saving?"A guardar…":"Aceitar e entrar na aplicação"}</button><p className="mt-4 text-center text-xs text-muted-foreground">Se não aceitar, não poderá entrar na aplicação.</p></section></main>;
}
