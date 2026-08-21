import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { modo: "entrar" } });
    return { user: data.user };
  },
  component: () => (
    <>
      <Outlet />
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
  ),
});
