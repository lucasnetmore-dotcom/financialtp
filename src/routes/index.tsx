import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { PLANS } from "@/lib/plans";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Finance Flow AI — gestão financeira com insights inteligentes" },
      {
        name: "description",
        content:
          "Controle entradas e saídas, sincronize PC e telemóvel, e receba insights de IA. Free, Pro €9,90 e Business €19,90.",
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
    <main className="relative min-h-screen px-5 py-12 lg:px-10">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-5xl">
        <section className="mx-auto max-w-2xl text-center animate-fade-up">
          <p className="eyebrow">Para negócios locais e freelancers</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Finance <span className="gold-text">Flow AI</span>
          </h1>
          <p className="mt-5 text-base text-muted-foreground sm:text-lg">
            Entradas, saídas e meta mensal num só sítio — sincronizado no telemóvel e no PC, com
            insights automáticos a partir dos seus dados reais.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
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
          <p className="mt-4 text-xs text-muted-foreground">
            Sem cartão no plano Free · Cancele quando quiser · Pagamentos seguros Stripe
          </p>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Sincronização em tempo real",
            "Insights de margem e meta",
            "Exportação PDF, Excel e CSV",
            "Notificações inteligentes",
          ].map((item) => (
            <div key={item} className="panel panel-lift px-4 py-4 text-sm">
              <Check className="mb-2 size-4 text-primary" />
              {item}
            </div>
          ))}
        </section>

        <section className="mt-16" id="precos">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight">Preços simples</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-muted-foreground">
            Comece grátis. Faça upgrade quando precisar de lançamentos ilimitados.
          </p>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  "panel flex flex-col p-6",
                  plan.highlight && "ring-1 ring-primary/40",
                )}
              >
                <h3 className="font-display text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                <p className="mt-4 font-display text-3xl font-bold">
                  {plan.price}
                  <span className="ml-1 text-xs font-medium text-muted-foreground">{plan.period}</span>
                </p>
                <ul className="mt-5 grid flex-1 gap-2 text-sm text-muted-foreground">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6 w-full" variant={plan.highlight ? "default" : "outline"}>
                  <Link to={signedIn ? "/planos" : "/auth"}>
                    {plan.id === "free" ? "Começar grátis" : `Escolher ${plan.name}`}
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-xl">
          <h2 className="text-center font-display text-xl font-bold">Perguntas frequentes</h2>
          <dl className="mt-6 space-y-4 text-sm">
            <div className="panel p-4">
              <dt className="font-semibold">Posso cancelar a qualquer momento?</dt>
              <dd className="mt-1 text-muted-foreground">
                Sim. Na área de planos use “Gerir / cancelar”. O acesso pago continua até ao fim do
                período já pago.
              </dd>
            </div>
            <div className="panel p-4">
              <dt className="font-semibold">Os meus dados estão seguros?</dt>
              <dd className="mt-1 text-muted-foreground">
                Cada conta só vê os seus lançamentos. Pagamentos são processados pela Stripe — não
                guardamos números de cartão. Pode apagar a conta nas definições (RGPD).
              </dd>
            </div>
            <div className="panel p-4">
              <dt className="font-semibold">Funciona no telemóvel?</dt>
              <dd className="mt-1 text-muted-foreground">
                Sim. Abra o site no browser do telemóvel com a mesma conta — os dados sincronizam em
                tempo real.
              </dd>
            </div>
            <div className="panel p-4">
              <dt className="font-semibold">Preciso de ajuda?</dt>
              <dd className="mt-1 text-muted-foreground">
                Escreva para{" "}
                <a className="text-primary underline" href={SUPPORT_MAILTO}>
                  {SUPPORT_EMAIL}
                </a>
                .
              </dd>
            </div>
          </dl>
        </section>

        <footer className="mt-16 flex flex-wrap justify-center gap-4 border-t border-border/60 pt-8 text-xs text-muted-foreground">
          <Link to="/privacidade" className="hover:text-foreground">
            Privacidade
          </Link>
          <Link to="/termos" className="hover:text-foreground">
            Termos
          </Link>
          <a href={SUPPORT_MAILTO} className="hover:text-foreground">
            Suporte
          </a>
        </footer>
      </div>
    </main>
  );
}
