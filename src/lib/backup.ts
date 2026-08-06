import type { Entry, Profile, Settings } from "@/lib/finance";

export interface BackupFile {
  app: "prosper-financas";
  version: 1;
  created_at: string;
  entries: Entry[];
  settings: Settings | null;
  profile: Profile | null;
}

export interface BackupRecord {
  id: string;
  created_at: string;
  entries: number;
  auto: boolean;
}

const HISTORY_KEY = "prosper.backups";
const MAX_HISTORY = 10;

export function buildBackup(
  entries: Entry[],
  settings: Settings | null,
  profile: Profile | null,
): BackupFile {
  return {
    app: "prosper-financas",
    version: 1,
    created_at: new Date().toISOString(),
    entries,
    settings,
    profile,
  };
}

export function readHistory(): BackupRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]") as BackupRecord[];
  } catch {
    return [];
  }
}

function writeHistory(list: BackupRecord[]) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
}

export function storeBackup(backup: BackupFile, auto: boolean) {
  const id = backup.created_at;
  window.localStorage.setItem(`${HISTORY_KEY}.${id}`, JSON.stringify(backup));
  const history = [
    { id, created_at: backup.created_at, entries: backup.entries.length, auto },
    ...readHistory(),
  ];
  const dropped = history.slice(MAX_HISTORY);
  for (const item of dropped) window.localStorage.removeItem(`${HISTORY_KEY}.${item.id}`);
  writeHistory(history);
  return id;
}

export function loadBackup(id: string): BackupFile | null {
  try {
    const raw = window.localStorage.getItem(`${HISTORY_KEY}.${id}`);
    return raw ? (JSON.parse(raw) as BackupFile) : null;
  } catch {
    return null;
  }
}

export function downloadBackup(backup: BackupFile) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backup-prosper-${backup.created_at.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function parseBackup(text: string): BackupFile {
  const data = JSON.parse(text) as Partial<BackupFile>;
  if (!data || !Array.isArray(data.entries)) {
    throw new Error("Ficheiro de backup inválido.");
  }
  return {
    app: "prosper-financas",
    version: 1,
    created_at: data.created_at ?? new Date().toISOString(),
    entries: data.entries,
    settings: data.settings ?? null,
    profile: data.profile ?? null,
  };
}

/** Cria no máximo um backup automático por dia, no dispositivo. */
export function maybeAutoBackup(
  entries: Entry[],
  settings: Settings | null,
  profile: Profile | null,
) {
  if (typeof window === "undefined" || entries.length === 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const last = readHistory().find((b) => b.auto);
  if (last && last.created_at.slice(0, 10) === today) return;
  storeBackup(buildBackup(entries, settings, profile), true);
}
