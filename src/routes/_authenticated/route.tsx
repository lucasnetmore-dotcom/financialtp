import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { modo: "entrar" } });
    return { user: data.user };
  },
  component: () => {
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    const inCrm = pathname === "/crm";

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
        <Link
          to="/crm"
          className="fixed bottom-5 left-5 z-50 hidden items-center gap-2.5 rounded-xl border border-border/70 bg-sidebar px-4 py-3 text-sm font-semibold text-sidebar-foreground shadow-lg ring-1 ring-black/5 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
          activeProps={{ className: "fixed bottom-5 left-5 z-50 hidden items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary shadow-lg ring-1 ring-primary/10 lg:flex" }}
        >
          <CalendarDays className="size-4" />
          CRM / Agenda
        </Link>
        <Link
          to="/crm"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg lg:hidden"
        >
          <CalendarDays className="size-4" />
          Agenda
        </Link>
      </>
    );
  },
});
