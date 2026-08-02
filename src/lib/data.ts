import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Entry, Profile, Settings } from "@/lib/finance";
import { outbox } from "@/lib/outbox";
import { useSync } from "@/lib/sync";

export function useAuthUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setEmail(session?.user?.email ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { userId, email, ready };
}

export function useEntries(userId: string | null) {
  return useQuery({
    queryKey: ["entries", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, value: Number(row.value) })) as Entry[];
    },
  });
}

export function useSettings(userId: string | null) {
  return useQuery({
    queryKey: ["settings", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Settings | null> => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      return data ? ({ ...data, monthly_goal: Number(data.monthly_goal) } as Settings) : null;
    },
  });
}

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return (data as Profile) ?? null;
    },
  });
}

export interface EntryInput {
  id: string;
  type: Entry["type"];
  value: number;
  entry_date: string;
  category: string;
  description: string;
  payment: string;
  client: string;
  notes: string;
  /** updated_at do registo que estava a ser editado — usado para detetar conflitos */
  baseUpdatedAt?: string | null;
}

function invalidate(queryClient: QueryClient, userId: string | null) {
  void queryClient.invalidateQueries({ queryKey: ["entries", userId] });
}

export function useSaveEntry(userId: string | null) {
  const queryClient = useQueryClient();
  const { markSyncing, markSynced, markError, refreshPending } = useSync();

  return useMutation({
    mutationFn: async (input: EntryInput) => {
      if (!userId) throw new Error("Sessão terminada.");
      const { baseUpdatedAt, ...record } = input;
      const payload = { ...record, user_id: userId };

      if (!navigator.onLine) {
        outbox.add({ id: input.id, kind: "upsert-entry", payload: record });
        refreshPending();
        return { offline: true as const };
      }

      if (baseUpdatedAt) {
        // Controlo de conflitos: só atualiza se ninguém tiver mexido entretanto.
        const { data, error } = await supabase
          .from("entries")
          .update(record as never)
          .eq("id", input.id)
          .eq("updated_at", baseUpdatedAt)
          .select();
        if (error) throw error;
        if (!data || data.length === 0) {
          const { data: current } = await supabase
            .from("entries")
            .select("*")
            .eq("id", input.id)
            .maybeSingle();
          if (current) return { conflict: true as const };
        }
        return { offline: false as const };
      }

      // id gerado no dispositivo + upsert = nunca cria duplicados
      const { error } = await supabase
        .from("entries")
        .upsert(payload as never, { onConflict: "id" });
      if (error) throw error;
      return { offline: false as const };
    },
    onMutate: () => markSyncing(),
    onSuccess: (result) => {
      markSynced();
      invalidate(queryClient, userId);
      if ("conflict" in result && result.conflict) {
        toast.warning("Este lançamento foi alterado noutro dispositivo. Mostrámos a versão mais recente.");
      } else if (result.offline) {
        toast.info("Sem ligação — guardado e será enviado assim que voltar a internet.");
      }
    },
    onError: (error: Error) => markError(error.message || "Não foi possível guardar."),
  });
}

export function useDeleteEntry(userId: string | null) {
  const queryClient = useQueryClient();
  const { markSyncing, markSynced, markError, refreshPending } = useSync();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!navigator.onLine) {
        outbox.add({ id, kind: "delete-entry", payload: { id } });
        refreshPending();
        return;
      }
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      markSyncing();
      await queryClient.cancelQueries({ queryKey: ["entries", userId] });
      const previous = queryClient.getQueryData<Entry[]>(["entries", userId]);
      queryClient.setQueryData<Entry[]>(["entries", userId], (old) =>
        (old ?? []).filter((e) => e.id !== id),
      );
      return { previous };
    },
    onSuccess: () => {
      markSynced();
      invalidate(queryClient, userId);
    },
    onError: (error: Error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["entries", userId], context.previous);
      markError(error.message || "Não foi possível eliminar.");
    },
  });
}

export function useSaveSettings(userId: string | null) {
  const queryClient = useQueryClient();
  const { markSyncing, markSynced, markError, refreshPending } = useSync();

  return useMutation({
    mutationFn: async (patch: { monthly_goal?: number; currency?: string }) => {
      if (!userId) throw new Error("Sessão terminada.");
      if (!navigator.onLine) {
        outbox.add({ id: userId, kind: "update-settings", payload: patch });
        refreshPending();
        return;
      }
      const { error } = await supabase
        .from("settings")
        .upsert({ ...patch, user_id: userId } as never, { onConflict: "user_id" });
      if (error) throw error;
    },
    onMutate: () => markSyncing(),
    onSuccess: () => {
      markSynced();
      void queryClient.invalidateQueries({ queryKey: ["settings", userId] });
    },
    onError: (error: Error) => markError(error.message || "Não foi possível guardar as definições."),
  });
}

export function useSaveProfile(userId: string | null) {
  const queryClient = useQueryClient();
  const { markSyncing, markSynced, markError, refreshPending } = useSync();

  return useMutation({
    mutationFn: async (patch: { company_name?: string; owner_name?: string }) => {
      if (!userId) throw new Error("Sessão terminada.");
      if (!navigator.onLine) {
        outbox.add({ id: userId, kind: "update-profile", payload: patch });
        refreshPending();
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .upsert({ ...patch, id: userId } as never, { onConflict: "id" });
      if (error) throw error;
    },
    onMutate: () => markSyncing(),
    onSuccess: () => {
      markSynced();
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (error: Error) => markError(error.message || "Não foi possível guardar o perfil."),
  });
}
