import { Check, CloudOff, Loader2, RefreshCw, TriangleAlert } from "lucide-react";

import { useSync } from "@/lib/sync";
import { cn } from "@/lib/utils";

export function SyncBadge({ className }: { className?: string }) {
  const { state, lastSyncedAt, pending } = useSync();

  const config = {
    synced: {
      icon: <Check className="size-3.5" />,
      label: "Sincronizado",
      tone: "bg-success-soft text-success",
    },
    syncing: {
      icon: <Loader2 className="size-3.5 animate-spin" />,
      label: pending > 0 ? `A enviar ${pending} alteração(ões)…` : "A sincronizar…",
      tone: "bg-primary-soft text-primary-dark",
    },
    connecting: {
      icon: <RefreshCw className="size-3.5 animate-spin" />,
      label: "A ligar…",
      tone: "bg-muted text-muted-foreground",
    },
    offline: {
      icon: <CloudOff className="size-3.5" />,
      label: pending > 0 ? `Offline · ${pending} por enviar` : "Offline",
      tone: "bg-danger-soft text-destructive",
    },
    error: {
      icon: <TriangleAlert className="size-3.5" />,
      label: "Erro de sincronização",
      tone: "bg-danger-soft text-destructive",
    },
  }[state];

  return (
    <span
      title={
        lastSyncedAt
          ? `Última sincronização: ${lastSyncedAt.toLocaleTimeString("pt-PT")}`
          : undefined
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        config.tone,
        className,
      )}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
