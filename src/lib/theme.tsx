import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "ftp-theme";

interface ThemeContextValue {
  /** Preferência escolhida pelo utilizador (pode ser "system"). */
  preference: ThemePreference;
  /** Tema realmente aplicado neste momento. */
  theme: ResolvedTheme;
  setPreference: (value: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Script inline que evita o "flash" de tema errado antes da hidratação. */
export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=p==='dark'||((!p||p==='system')&&m);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<ResolvedTheme>("light");

  // Lê a preferência guardada apenas no cliente (evita mismatch de hidratação).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const pref: ThemePreference =
      stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setPreferenceState(pref);
    const resolved = pref === "system" ? systemTheme() : pref;
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  // Acompanha o tema do sistema operativo quando a preferência é "system".
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = systemTheme();
      setTheme(resolved);
      applyTheme(resolved);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    window.localStorage.setItem(STORAGE_KEY, value);
    const resolved = value === "system" ? systemTheme() : value;
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  const toggle = useCallback(() => {
    setPreference(theme === "dark" ? "light" : "dark");
  }, [setPreference, theme]);

  const value = useMemo(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme tem de ser usado dentro de <ThemeProvider>");
  return ctx;
}
