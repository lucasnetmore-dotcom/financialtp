import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  confirmCheckoutSession,
  createCheckoutSession,
  syncSubscriptionFromStripe,
} from "@/lib/billing.functions";
import { useAuthUser, useEntries, useProfile } from "@/lib/data";
import { getPlanAccess, PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos | Finance Flow AI" },
      {
        name: "description",
        content:
          "Compare os planos Free, Pro e Business do Finance Flow AI e escolha o limite de lançamentos certo para o seu negócio.",
      },
      { property: "og:title", content: "Planos | Finance Flow AI" },
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
  const confirmCheckout = useServerFn(confirmCheckoutSession);
  const syncSub = useServerFn(syncSubscriptionFromStripe);
  const queryClient = useQueryClient();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const handledCheckout = useRef(false);
  const didAutoSync = useRef(false);

  async function refreshProfile() {
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    await profileQuery.refetch();
  }

  async function runSync(opts?: { silent?: boolean }) {
    setSyncing(true);
    try {
      await supabase.auth.refreshSession();
      const result = await syncSub();
      await refreshProfile();
      if (!opts?.silent) {
        if (result.plan === "business" || result.plan === "pro") {
          toast.success(
            result.already
              ? `Plano ${result.plan === "business" ? "Business" : "Pro"} já estava ativo.`
              : `Plano ${result.plan === "business" ? "Business" : "Pro"} sincronizado!`,
          );
        } else if (result.synced) {
          toast.info("Sem subscrição ativa na Stripe — plano Free.");
        } else {
          toast.message("Não encontrámos pagamento associado a esta conta na Stripe.");
        }
      } else if (result.synced && !result.already && result.plan !== "free") {
        toast.success(`Plano ${result.plan === "business" ? "Business" : "Pro"} ativado!`);
      }
      return result;
    } catch (error) {
      if (!opts?.silent) {
        toast.error(error instanceof Error ? error.message : "Falha ao sincronizar o plano.");
      }
      throw error;
    } finally {
      setSyncing(false);
    }
  }

  // Ao abrir a página: tenta sincronizar se ainda está free (recupera pagamentos já feitos)
  useEffect(() => {
    if (!userId || didAutoSync.current) return;
    if (profileQuery.isLoading) return;
    didAutoSync.current = true;
    const current = profileQuery.data?.plan ?? "free";
    if (current === "free") {
      void runSync({ silent: true }).catch(() => {
        /* silencioso */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profileQuery.isLoading, profileQuery.data?.plan]);

  useEffect(() => {
    if (handledCheckout.current) return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("checkout");
    if (!result) return;
    handledCheckout.current = true;

    const sessionId = params.get("session_id");
    window.history.replaceState({}, "", window.location.pathname);

    if (result === "cancel") {
      toast.info("Pagamento cancelado.");
      return;
    }
    if (result !== "success") return;

    void (async () => {
      setActivating(true);
      toast.loading("A ativar o seu plano…", { id: "activate-plan" });
      try {
        await supabase.auth.refreshSession();

        if (sessionId?.startsWith("cs_")) {
          const { plan } = await confirmCheckout({ data: { sessionId } });
          await refreshProfile();
          toast.success(`Plano ${plan === "business" ? "Business" : "Pro"} ativado!`, {
            id: "activate-plan",
          });
        } else {
          await runSync({ silent: true });
          toast.success("Pagamento recebido. Plano sincronizado.", { id: "activate-plan" });
        }
      } catch (error) {
        try {
          await runSync({ silent: true });
          toast.success("Plano sincronizado a partir da Stripe.", { id: "activate-plan" });
        } catch {
          toast.error(
            error instanceof Error ? error.message : "Não foi possível ativar o plano.",
            { id: "activate-plan" },
          );
        }
      } finally {
        setActivating(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpgrade(plan: "pro" | "business") {
    setLoadingPlan(plan);
    try {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session?.access_token) {
        const { data: existing } = await supabase.auth.getSession();
        if (!existing.session?.access_token) {
          throw new Error("Sessão expirada. Faça login novamente e tente outra vez.");
        }
      }

      const { url } = await startCheckout({
        data: { plan, origin: window.location.origin },
      });
      window.location.href = url;
    } catch (error) {
      setLoadingPlan(null);
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o pagamento.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 py-9 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/painel"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar ao painel
        </Link>
        <Button
          variant="outline"
          size="sm"
          disabled={syncing || activating}
          onClick={() => void runSync()}
        >
          {syncing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Sincronizar plano
        </Button>
      </div>

      <header className="mt-5 animate-fade-up">
        <p className="eyebrow">Subscrição</p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight lg:text-[2.1rem]">
          Escolha o seu <span className="gold-text">plano</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {activating || syncing ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              A sincronizar o plano com a Stripe…
            </span>
          ) : (
            <>
              Está no plano <strong>{access.planName}</strong>
              {access.limit !== null
                ? ` — ${access.usedThisMonth} de ${access.limit} lançamentos usados este mês.`
                : " — lançamentos ilimitados."}
            </>
          )}
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
                    disabled={loadingPlan !== null || activating || syncing}
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
