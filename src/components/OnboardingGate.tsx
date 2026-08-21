import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export function OnboardingGate({ onComplete }: { onComplete: () => void }) {
  const [business, setBusiness] = useState("");
  const [type, setType] = useState("Salão / beleza");
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("19:00");
  const [saving, setSaving] = useState(false);

  async function finish() {
    if (!business.trim()) {
      toast.error("Indique o nome do seu negócio.");
      return;
    }
    setSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          business_name: business.trim(),
          business_type: type,
          business_hours: { open, close },
        },
      });
      if (authError) throw authError;

      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        await supabase.from("profiles").update({ company_name: business.trim() }).eq("id", user.user.id);
      }
      onComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar a configuração.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="fixed inset-0 z-[190] grid place-items-center overflow-y-auto bg-background px-5 py-8">
      <section className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-2xl sm:p-8">
        <p className="eyebrow">Finance Flow AI</p>
        <h1 className="mt-2 text-2xl font-bold">Vamos configurar o seu negócio</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          São só alguns dados para deixar o painel, CRM e agenda prontos para si.
        </p>
        <div className="mt-6 grid gap-4">
          <div><Label htmlFor="business">Nome do negócio *</Label><Input id="business" className="mt-1.5" value={business} onChange={e=>setBusiness(e.target.value)} placeholder="Ex.: Studio Lucas" autoFocus /></div>
          <div><Label htmlFor="type">Tipo de negócio</Label><select id="type" className="mt-1.5 h-10 w-full rounded-lg border bg-background px-3 text-sm" value={type} onChange={e=>setType(e.target.value)}><option>Salão / beleza</option><option>Barbearia</option><option>Estética</option><option>Consultório</option><option>Serviços</option><option>Outro</option></select></div>
          <div><Label>Horário habitual</Label><div className="mt-1.5 grid grid-cols-2 gap-3"><Input type="time" value={open} onChange={e=>setOpen(e.target.value)} /><Input type="time" value={close} onChange={e=>setClose(e.target.value)} /></div></div>
          <Button className="mt-2 w-full" disabled={saving} onClick={()=>void finish()}>{saving?"A configurar…":"Entrar no meu painel"}</Button>
        </div>
      </section>
    </main>
  );
}
