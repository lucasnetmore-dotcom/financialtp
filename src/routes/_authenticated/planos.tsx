import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/lib/billing.functions";
import { useAuthUser, useEntries, useProfile } from "@/lib/data";
import { getPlanAccess, PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos | FINANCEIRO TP" },
      {
        name: "description",
        content:
          "Compare os planos Free, Pro e Business do FINANCEIRO TP e escolha o limite de lançamentos certo para o seu negócio.",
      },
      { property: "og:title", content: "Planos | FINANCEIRO TP" },
      {
        property: "og:description",
        content: "Free, Pro e Business — lançamentos ilimitados e relatórios avançados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanosPage,
});

function PlanosPage() {
  const { userId } = useAuthUser();
  const entriesQuery = useEntries(userId);
  const profileQuery = useProfile(userId);
  const access = getPlanAccess(profileQuery.data, entriesQuery.data ?? []);
  const startCheckout = useServerFn(createCheckoutSession);
  const queryClient = useQueryClient();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Regresso do Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("checkout");
    if (!result) return;
    window.history.replaceState({}, "", window.location.pathname);

    if (result === "cancel") {
      toast.info("Pagamento cancelado.");
      return;
    }
    toast.success("Pagamento confirmado! A ativar o seu plano…");

    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (tries >= 6) window.clearInterval(timer);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [queryClient]);

  async function handleUpgrade(plan: "pro" | "business") {
    setLoadingPlan(plan);
    try {
      const { url } = await startCheckout({
        data: { plan, origin: window.location.origin },
      });
      window.location.href = url;
    } catch (error) {
      setLoadingPlan(null);
      toast.error(
        error instanceof Error ? error.message : "Não foi possível abrir o pagamento.",
      );
    }
  }



  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 py-9 lg:px-10">
      <Link
        to="/painel"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar ao painel
      </Link>

      <header className="mt-5 animate-fade-up">
        <p className="eyebrow">Subscrição</p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight lg:text-[2.1rem]">
          Escolha o seu <span className="gold-text">plano</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Está no plano <strong>{access.planName}</strong>
          {access.limit !== null
            ? ` — ${access.usedThisMonth} de ${access.limit} lançamentos usados este mês.`
            : " — lançamentos ilimitados."}
        </p>
      </header>

      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const current = plan.id === access.plan;
          return (
            <section
              key={plan.id}
              className={cn(
                "panel flex flex-col p-6",
                plan.highlight && "ring-1 ring-primary/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold">{plan.name}</h2>
                {current ? (
                  <span className="rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/25">
                    Plano atual
                  </span>
                ) : plan.highlight ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
                    <Sparkles className="size-3" />
                    Mais popular
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

              <p className="mt-4 font-display text-3xl font-bold tracking-tight">
                {plan.price}
                <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                  {plan.period}
                </span>
              </p>

              <ul className="mt-5 grid gap-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-1">
                {current ? (
                  <Button variant="outline" className="w-full" disabled>
                    Plano atual
                  </Button>
                ) : plan.id === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    Incluído
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={loadingPlan !== null}
                    onClick={() => void handleUpgrade(plan.id as "pro" | "business")}
                  >
                    {loadingPlan === plan.id ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        A abrir pagamento…
                      </>
                    ) : (
                      <>Upgrade para {plan.name}</>
                    )}
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
