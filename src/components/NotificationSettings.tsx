import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  loadPrefs,
  requestPushPermission,
  savePrefs,
  type NotificationPrefs,
} from "@/lib/notifications";

const TOGGLES: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "aiTip", label: "Dicas de IA", hint: "Insights sobre margem, meta e categorias." },
  { key: "goal", label: "Meta mensal", hint: "Avisa quando atinge a meta ou quando fica em risco." },
  { key: "negativeBalance", label: "Saldo negativo", hint: "Quando as saídas superam as entradas." },
  { key: "highSpend", label: "Gastos elevados", hint: "Dias com saídas acima da sua média." },
  { key: "categorySpike", label: "Categoria acima do habitual", hint: "Compara com os meses anteriores." },
  { key: "inactivity", label: "Lembrete de registo", hint: "Quando fica dias sem lançar movimentos." },
  { key: "weeklySummary", label: "Resumo semanal", hint: "Todas as segundas-feiras." },
];

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  function update(patch: Partial<NotificationPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
    window.dispatchEvent(new Event("ftp-notif-prefs"));
  }

  async function togglePush(on: boolean) {
    if (!on) return update({ push: false });
    const granted = await requestPushPermission();
    if (!granted) {
      toast.error("O dispositivo não autorizou as notificações do sistema.");
      return;
    }
    update({ push: true });
    toast.success("Notificações do sistema ativadas.");
  }

  return (
    <div className="panel p-5 lg:p-6">
      <h2 className="font-display text-base font-semibold">Notificações inteligentes</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Alertas e dicas de IA calculados a partir dos seus lançamentos — no dispositivo.
      </p>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-accent/50 p-3.5">
        <div>
          <p className="text-sm font-medium">Ativar notificações</p>
          <p className="text-xs text-muted-foreground">Liga ou desliga todos os alertas.</p>
        </div>
        <Switch checked={prefs.enabled} onCheckedChange={(v) => update({ enabled: v })} />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-border p-3.5">
        <div>
          <p className="text-sm font-medium">Avisos no sistema</p>
          <p className="text-xs text-muted-foreground">
            Mostra alertas fora da aplicação (computador e Android).
          </p>
        </div>
        <Switch
          checked={prefs.push}
          disabled={!prefs.enabled}
          onCheckedChange={(v) => void togglePush(v)}
        />
      </div>

      <ul className="mt-4 grid gap-2.5">
        {TOGGLES.map((t) => (
          <li key={t.key} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.hint}</p>
            </div>
            <Switch
              checked={Boolean(prefs[t.key])}
              disabled={!prefs.enabled}
              onCheckedChange={(v) => update({ [t.key]: v } as Partial<NotificationPrefs>)}
            />
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="high-spend-factor">Gasto elevado (x média diária)</Label>
          <Input
            id="high-spend-factor"
            type="number"
            min="1"
            step="0.5"
            disabled={!prefs.enabled}
            value={prefs.highSpendFactor}
            onChange={(e) => update({ highSpendFactor: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="inactivity-days">Lembrete após (dias)</Label>
          <Input
            id="inactivity-days"
            type="number"
            min="1"
            step="1"
            disabled={!prefs.enabled}
            value={prefs.inactivityDays}
            onChange={(e) => update({ inactivityDays: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
      </div>
    </div>
  );
}
