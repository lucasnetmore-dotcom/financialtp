import { Bell, BellOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildAlerts,
  loadPrefs,
  pushNewAlerts,
  seenAlerts,
  type AlertLevel,
  type SmartAlert,
} from "@/lib/notifications";
import type { Entry, Settings } from "@/lib/finance";
import { cn } from "@/lib/utils";

const levelStyles: Record<AlertLevel, string> = {
  info: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  danger: "bg-destructive/12 text-destructive",
};

export function NotificationsBell({
  entries,
  settings,
}: {
  entries: Entry[];
  settings: Settings | null;
}) {
  const [prefsVersion, setPrefsVersion] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSeen(seenAlerts.list());
    const onChange = () => setPrefsVersion((v) => v + 1);
    window.addEventListener("ftp-notif-prefs", onChange);
    return () => window.removeEventListener("ftp-notif-prefs", onChange);
  }, []);

  const prefs = useMemo(() => loadPrefs(), [prefsVersion]);
  const alerts: SmartAlert[] = useMemo(
    () => buildAlerts(entries, settings, prefs),
    [entries, settings, prefs],
  );

  useEffect(() => {
    if (prefs.enabled && prefs.push) pushNewAlerts(alerts);
  }, [alerts, prefs.enabled, prefs.push]);

  const unread = alerts.filter((a) => !seen.includes(a.id));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && unread.length) {
      const ids = alerts.map((a) => a.id);
      seenAlerts.markAll(ids);
      setTimeout(() => setSeen(seenAlerts.list()), 400);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-9 w-9" aria-label="Notificações">
          {prefs.enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
          {unread.length > 0 && (
            <span className="absolute -top-1 -right-1 grid size-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-display text-sm font-semibold">Notificações</span>
          <span className="text-xs text-muted-foreground">{alerts.length} ativas</span>
        </div>
        <div className="max-h-[22rem] overflow-y-auto">
          {!prefs.enabled ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              As notificações estão desligadas. Ative-as em Definições.
            </p>
          ) : alerts.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Tudo em ordem — nenhum alerta neste momento.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((a) => (
                <li key={a.id} className="flex gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "mt-0.5 size-2 shrink-0 rounded-full",
                      a.level === "success"
                        ? "bg-emerald-500"
                        : a.level === "warning"
                          ? "bg-amber-500"
                          : a.level === "danger"
                            ? "bg-destructive"
                            : "bg-muted-foreground",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{a.body}</p>
                    <span
                      className={cn(
                        "mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                        levelStyles[a.level],
                      )}
                    >
                      {a.level === "danger"
                        ? "Atenção"
                        : a.level === "warning"
                          ? "Aviso"
                          : a.level === "success"
                            ? "Boa notícia"
                            : "Informação"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
