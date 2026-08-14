import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Finance Flow AI" },
      {
        name: "description",
        content: "Aceda à sua conta Finance Flow AI para ver os mesmos dados no PC e no iPhone.",
      },
      { property: "og:title", content: "Entrar | Finance Flow AI" },
      {
        property: "og:description",
        content: "Um só login para todos os seus dispositivos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    modo: search["modo"] === "registo" ? ("registo" as const) : ("entrar" as const),
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
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  async function handleOAuth(provider: "google" | "apple") {
    setOauthLoading(provider);
    try {
      const redirectTo = `${window.location.origin}/painel`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: false,
        },
      });
      if (error) {
        toast.error(error.message || "Não foi possível continuar com o login social.");
        return;
      }
      // Browser will redirect to the provider; if we somehow get a URL back without redirect, open it.
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
    } catch (error) {
      toast.error((error as Error).message ?? "Não foi possível continuar.");
    } finally {
      setOauthLoading(null);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      toast.error("Escreva primeiro o seu e-mail.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) toast.error(error.message);
    else toast.success("Enviámos-lhe um e-mail para redefinir a palavra-passe.");
  }

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
        <p className="eyebrow">Finance Flow AI</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
          {mode === "registo" ? "Criar conta" : "Entrar na conta"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A mesma conta dá acesso aos mesmos dados no PC e no iPhone.
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-7 w-full gap-2"
          disabled={oauthLoading !== null}
          onClick={() => handleOAuth("google")}
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.6c-.1 1.1-.9 2.8-2.5 3.9l3.8 3c2.3-2.1 3.6-5.2 3.6-8.8Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-3c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5l-3.9 3A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6l-3.9-3a12 12 0 0 0 0 10.6l3.9-3Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.8c2.2 0 3.7.9 4.5 1.7l3.3-3.2C17.9 1.3 15.2 0 12 0 7.3 0 3.3 2.7 1.4 6.7l3.9 3c.9-2.9 3.6-4.9 6.7-4.9Z"
            />
          </svg>
          {oauthLoading === "google" ? "A abrir o Google…" : "Continuar com Google"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full gap-2"
          disabled={oauthLoading !== null}
          onClick={() => handleOAuth("apple")}
        >
          <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
            <path d="M16.4 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.8c-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.6 2.3 2.8 2.3 1.1 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.4-.9-2.4-3.6ZM14.2 5.9c.6-.8 1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.9 1 .1 2-.5 2.7-1.3Z" />
          </svg>
          {oauthLoading === "apple" ? "A abrir a Apple…" : "Continuar com Apple"}
        </Button>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou com e-mail
          <span className="h-px flex-1 bg-border" />
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Palavra-passe</Label>
              {mode === "entrar" ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-primary-dark hover:underline"
                  onClick={handleForgotPassword}
                >
                  Esqueci-me
                </button>
              ) : null}
            </div>
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
