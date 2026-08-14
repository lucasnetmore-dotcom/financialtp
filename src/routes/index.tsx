import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Finance Flow AI — gestão financeira sincronizada" },
      {
        name: "description",
        content:
          "Controle entradas, saídas, metas e relatórios do seu negócio com sincronização automática entre PC e iPhone.",
      },
      { property: "og:title", content: "Finance Flow AI — gestão financeira sincronizada" },
      {
        property: "og:description",
        content: "Um só login, os mesmos dados em todos os dispositivos, em tempo real.",
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
    <main className="relative flex min-h-screen items-center justify-center px-6 py-16">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-xl text-center animate-fade-up">
        <p className="eyebrow">Gestão financeira inteligente</p>
        <h1 className="mt-3 font-display text-5xl font-bold tracking-tight">
          Finance <span className="gold-text">Flow AI</span>
        </h1>
        <p className="mt-5 text-base text-muted-foreground">
          Os seus lançamentos ficam guardados na nuvem e aparecem ao mesmo tempo no computador
          e no iPhone. Um só login, sempre sincronizado.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to={signedIn ? "/painel" : "/auth"}>
              {signedIn ? "Abrir painel" : "Entrar na minha conta"}
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
            "Base de dados única na nuvem — nada fica só no dispositivo",
            "Atualização em tempo real entre PC e iPhone",
            "Funciona offline e envia tudo ao reconectar",
          ].map((item) => (
            <li key={item} className="panel panel-lift px-4 py-3">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
