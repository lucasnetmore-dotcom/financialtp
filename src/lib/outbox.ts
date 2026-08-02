/**
 * Fila de saída (outbox) — usada APENAS quando o dispositivo está offline.
 * Não é a base de dados principal: é um buffer temporário que é enviado
 * para a nuvem assim que a ligação volta.
 */
export type OutboxOp =
  | { id: string; kind: "upsert-entry"; payload: Record<string, unknown> }
  | { id: string; kind: "delete-entry"; payload: { id: string } }
  | { id: string; kind: "update-settings"; payload: Record<string, unknown> }
  | { id: string; kind: "update-profile"; payload: Record<string, unknown> };

const KEY = "ftp-outbox-v1";

function read(): OutboxOp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

function write(ops: OutboxOp[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(ops));
}

export const outbox = {
  list: read,
  size: () => read().length,
  /** Evita duplicados: a mesma operação sobre o mesmo registo substitui a anterior. */
  add(op: OutboxOp) {
    const ops = read().filter((o) => !(o.kind === op.kind && o.id === op.id));
    ops.push(op);
    write(ops);
  },
  remove(id: string, kind: OutboxOp["kind"]) {
    write(read().filter((o) => !(o.id === id && o.kind === kind)));
  },
  clear() {
    write([]);
  },
};
