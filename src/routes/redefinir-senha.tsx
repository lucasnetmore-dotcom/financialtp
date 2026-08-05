import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir palavra-passe | FINANCEIRO TP" },
      {
        name: "description",
        content: "Defina uma nova palavra-passe para a sua conta FINANCEIRO TP.",
      },
      { property: "og:title", content: "Redefinir palavra-passe | FINANCEIRO TP" },
      {
        property: "og:description",
        content: "Escolha uma nova palavra-passe segura para a sua conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As palavras-passe não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Palavra-passe atualizada.");
    void navigate({ to: "/painel", replace: true });
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-14">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="panel panel-crown w-full max-w-md p-8 animate-fade-up">
        <p className="eyebrow">FINANCEIRO TP</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
          Nova palavra-passe
        </h1>
        {ready ? (
          <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-1.5">
              <Label htmlFor="new-password">Palavra-passe</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-password">Confirmar</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-1">
              {loading ? "A guardar…" : "Guardar palavra-passe"}
            </Button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Abra esta página através do link que recebeu por e-mail para poder definir uma
            nova palavra-passe.
          </p>
        )}
      </div>
    </main>
  );
}
