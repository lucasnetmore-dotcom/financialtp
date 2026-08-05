import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | FINANCEIRO TP" },
      {
        name: "description",
        content: "Aceda à sua conta FINANCEIRO TP para ver os mesmos dados no PC e no iPhone.",
      },
      { property: "og:title", content: "Entrar | FINANCEIRO TP" },
      {
        property: "og:description",
        content: "Um só login para todos os seus dispositivos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    modo: search['modo'] === "registo" ? ("registo" as const) : ("entrar" as const),
  }),
  component: AuthPage,
});

function AuthPage() {
  const { modo } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"entrar" | "registo">(modo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "registo") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/painel` },
        });
        if (error) throw error;
        if (data.session) {
          void navigate({ to: "/painel", replace: true });
        } else {
          toast.success("Conta criada. Confirme o e-mail que lhe enviámos para entrar.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: "/painel", replace: true });
      }
    } catch (error) {
      toast.error((error as Error).message ?? "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-14">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="panel panel-crown w-full max-w-md p-8 animate-fade-up">
        <p className="eyebrow">FINANCEIRO TP</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
          {mode === "registo" ? "Criar conta" : "Entrar na conta"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A mesma conta dá acesso aos mesmos dados no PC e no iPhone.
        </p>

        <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Palavra-passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "registo" ? "new-password" : "current-password"}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? "Aguarde…" : mode === "registo" ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-6 w-full text-sm text-muted-foreground underline-offset-4 hover:text-primary-dark hover:underline"
          onClick={() => setMode(mode === "registo" ? "entrar" : "registo")}
        >
          {mode === "registo"
            ? "Já tenho conta — entrar"
            : "Ainda não tenho conta — criar agora"}
        </button>
      </div>
    </main>
  );
}
