import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { outbox } from "@/lib/outbox";

export type SyncState = "connecting" | "synced" | "syncing" | "offline" | "error";

interface SyncContextValue {
  state: SyncState;
  lastSyncedAt: Date | null;
  pending: number;
  online: boolean;
  markSyncing: () => void;
  markSynced: () => void;
  markError: (message?: string) => void;
  refreshPending: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync tem de ser usado dentro de <SyncProvider>");
  return ctx;
}

export function SyncProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(true);
  const [channelReady, setChannelReady] = useState(false);
  const [busy, setBusy] = useState(0);
  const [errored, setErrored] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pending, setPending] = useState(0);
  const flushing = useRef(false);

  const refreshPending = useCallback(() => setPending(outbox.size()), []);

  const markSyncing = useCallback(() => setBusy((n) => n + 1), []);
  const markSynced = useCallback(() => {
    setBusy((n) => Math.max(0, n - 1));
    setErrored(false);
    setLastSyncedAt(new Date());
  }, []);
  const markError = useCallback((message?: string) => {
    setBusy((n) => Math.max(0, n - 1));
    setErrored(true);
    if (message) toast.error(message);
  }, []);

  // Estado da ligação à internet
  useEffect(() => {
    setOnline(navigator.onLine);
    refreshPending();
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [refreshPending]);

  // Envia a fila de saída assim que voltar a haver ligação
  const flush = useCallback(async () => {
    if (!userId || flushing.current || !navigator.onLine) return;
    const ops = outbox.list();
    if (!ops.length) return;
    flushing.current = true;
    try {
      for (const op of ops) {
        try {
          if (op.kind === "upsert-entry") {
            const { error } = await supabase
              .from("entries")
              .upsert({ ...op.payload, user_id: userId } as never, { onConflict: "id" });
            if (error) throw error;
          } else if (op.kind === "delete-entry") {
            const { error } = await supabase.from("entries").delete().eq("id", op.payload.id);
            if (error) throw error;
          } else if (op.kind === "update-settings") {
            const { error } = await supabase
              .from("settings")
              .upsert({ ...op.payload, user_id: userId } as never, { onConflict: "user_id" });
            if (error) throw error;
          } else if (op.kind === "update-profile") {
            const { error } = await supabase
              .from("profiles")
              .upsert({ ...op.payload, id: userId } as never, { onConflict: "id" });
            if (error) throw error;
          }
          outbox.remove(op.id, op.kind);
        } catch {
          // mantém na fila para nova tentativa
        }
      }
      refreshPending();
      await queryClient.invalidateQueries();
      setLastSyncedAt(new Date());
    } finally {
      flushing.current = false;
    }
  }, [queryClient, refreshPending, userId]);

  useEffect(() => {
    if (online) void flush();
  }, [online, flush]);

  // Atualiza tudo ao reconectar ou ao voltar à aplicação
  useEffect(() => {
    if (!userId) return;
    const resync = () => {
      if (!navigator.onLine) return;
      void flush();
      void queryClient.invalidateQueries();
      setLastSyncedAt(new Date());
    };
    window.addEventListener("online", resync);
    window.addEventListener("focus", resync);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") resync();
    });
    return () => {
      window.removeEventListener("online", resync);
      window.removeEventListener("focus", resync);
    };
  }, [flush, queryClient, userId]);

  // Realtime: qualquer alteração feita noutro dispositivo entra aqui
  useEffect(() => {
    if (!userId) return;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel(`sync-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entries", filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["entries", userId] });
          setLastSyncedAt(new Date());
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings", filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["settings", userId] });
          setLastSyncedAt(new Date());
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
          setLastSyncedAt(new Date());
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setChannelReady(true);
          setErrored(false);
          setLastSyncedAt(new Date());
          void queryClient.invalidateQueries();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setChannelReady(false);
          // reconexão automática
          retry = setTimeout(() => {
            void supabase.realtime.connect();
          }, 3000);
        }
      });

    return () => {
      if (retry) clearTimeout(retry);
      void supabase.removeChannel(channel);
      setChannelReady(false);
    };
  }, [queryClient, userId]);

  const state: SyncState = !online
    ? "offline"
    : errored
      ? "error"
      : busy > 0 || pending > 0
        ? "syncing"
        : channelReady
          ? "synced"
          : "connecting";

  const value = useMemo(
    () => ({
      state,
      lastSyncedAt,
      pending,
      online,
      markSyncing,
      markSynced,
      markError,
      refreshPending,
    }),
    [state, lastSyncedAt, pending, online, markSyncing, markSynced, markError, refreshPending],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
