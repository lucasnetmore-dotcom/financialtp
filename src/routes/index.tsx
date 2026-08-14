import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Finance Flow AI — gestão financeira com insights inteligentes" },
      {
        name: "description",
        content:
          "Controle entradas e saídas, sincronize PC e iPhone, e receba insights e dicas de IA a partir dos seus dados reais.",
      },
      { property: "og:title", content: "Finance Flow AI — gestão financeira inteligente" },
      {
        property: "og:description",
        content: "Um só login, sincronização em tempo real e insights automáticos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-xl text-center animate-fade-up">
        <p className="eyebrow">Gestão financeira inteligente</p>
        <h1 className="mt-3 font-display text-5xl font-bold tracking-tight">
          Finance <span className="gold-text">Flow AI</span>
        </h1>
        <p className="mt-5 text-base text-muted-foreground">
          Lançamentos na nuvem, sincronização entre PC e iPhone, e insights de IA com dicas
          práticas sobre margem, meta e categorias — a partir dos seus dados reais.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to={signedIn ? "/painel" : "/auth"}>
              {signedIn ? "Abrir painel" : "Começar grátis"}
            </Link>
          </Button>
          {!signedIn && (
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ modo: "registo" }}>
                Criar conta
              </Link>
            </Button>
          )}
        </div>
        <ul className="mx-auto mt-12 grid max-w-md gap-3 text-left text-sm text-muted-foreground">
          {[
            "Sincronização em tempo real entre todos os dispositivos",
            "Insights de IA: margem, ritmo da meta e categorias",
            "Notificações inteligentes e dicas acionáveis",
            "Planos Free, Pro (€9,90) e Business (€19,90)",
          ].map((item) => (
            <li key={item} className="panel panel-lift px-4 py-3">
              {item}
            </li>
          ))}
        </ul>
      </div>
      <footer className="mt-16 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <Link to="/privacidade" className="hover:text-foreground">
          Privacidade
        </Link>
        <Link to="/termos" className="hover:text-foreground">
          Termos
        </Link>
        <a href="mailto:suporte@financeflow.ai" className="hover:text-foreground">
          Suporte
        </a>
      </footer>
    </main>
  );
}
