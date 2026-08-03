import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Escuro", icon: Moon },
  { id: "system", label: "Automático", icon: Monitor },
];

/** Seletor de tema em três estados: claro, escuro e automático (segue o sistema). */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label="Tema"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1",
        className,
      )}
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={preference === id}
          onClick={() => setPreference(id)}
          className={cn(
            "grid size-7 place-items-center rounded-full transition-all duration-200",
            preference === id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
