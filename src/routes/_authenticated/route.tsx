import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getEffectivePlan } from "@/lib/billing.functions";

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
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", data.user.id)
          .maybeSingle();
        plan = profile?.plan ?? "free";
      }

      if (plan !== "pro" && plan !== "business") {
        throw redirect({ to: "/planos" });
      }
    }

    return { user: data.user };
  },
  component: () => {
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    const inCrm = pathname === "/crm";
    const [canAccessCrm, setCanAccessCrm] = useState(false);

    useEffect(() => {
      let active = true;
      void getEffectivePlan()
        .then((result) => {
          if (active) setCanAccessCrm(result.plan === "pro" || result.plan === "business");
        })
        .catch(async () => {
          const { data } = await supabase.auth.getUser();
          if (!data.user) return;
          const { data: profile } = await supabase
            .from("profiles")
            .select("plan")
            .eq("user_id", data.user.id)
            .maybeSingle();
          if (active) setCanAccessCrm(profile?.plan === "pro" || profile?.plan === "business");
        });
      return () => {
        active = false;
      };
    }, [pathname]);

    return (
      <>
        <Outlet />
        {inCrm && (
          <Link
            to="/painel"
            aria-label="Voltar para lançamentos e caixa"
            className="fixed left-3 top-3 z-[100] inline-flex items-center gap-2 rounded-xl border-2 border-primary/30 bg-background px-4 py-3 text-sm font-bold text-foreground shadow-xl ring-1 ring-black/5 backdrop-blur transition-all hover:bg-primary hover:text-primary-foreground sm:left-5 sm:top-5"
          >
            <ArrowLeft className="size-5" />
            <span className="hidden sm:inline">VOLTAR PARA LANÇAMENTOS E CAIXA</span>
            <span className="sm:hidden">VOLTAR</span>
          </Link>
        )}

        {!inCrm && (
          <>
            {canAccessCrm ? (
              <Link
                to="/crm"
                aria-label="Abrir CRM e Agenda"
                className="fixed bottom-5 left-5 z-50 hidden w-[236px] items-center gap-2.5 rounded-xl border border-border/70 bg-sidebar px-4 py-3 text-sm font-semibold text-sidebar-foreground shadow-lg ring-1 ring-black/5 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
              >
                <CalendarDays className="size-4 text-primary" />
                CRM / Agenda
              </Link>
            ) : (
              <Link
                to="/planos"
                aria-label="CRM e Agenda exclusivo dos planos Pro e Business"
                className="fixed bottom-5 left-5 z-50 hidden w-[236px] items-center gap-2.5 rounded-xl border border-border/70 bg-sidebar px-4 py-3 text-sm font-semibold text-sidebar-foreground shadow-lg ring-1 ring-black/5 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
              >
                <CalendarDays className="size-4 text-muted-foreground" />
                <span>CRM / Agenda</span>
                <LockKeyhole className="ml-auto size-3.5 text-muted-foreground" />
              </Link>
            )}
            {canAccessCrm ? (
              <Link
                to="/crm"
                aria-label="Abrir Agenda"
                className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg lg:hidden"
              >
                <CalendarDays className="size-4" />
                Agenda
              </Link>
            ) : (
              <Link
                to="/planos"
                aria-label="Agenda exclusiva dos planos Pro e Business"
                className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg lg:hidden"
              >
                <CalendarDays className="size-4" />
                Agenda <LockKeyhole className="size-3.5" />
              </Link>
            )}
          </>
        )}
      </>
    );
  },
});
