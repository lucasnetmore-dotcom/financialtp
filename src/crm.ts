import type { Entry } from "@/lib/finance";

export type ClientStatus = "active" | "inactive" | "lead" | "vip";

/** Cliente virtual derivado dos lançamentos (não precisa de tabela no banco) */
export interface CrmClient {
  id: string; // slug do nome
  name: string;
  first_contact_date: string;
  last_entry_date: string | null;
  total_income: number;
  total_expense: number;
  entries_count: number;
  status: ClientStatus;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "sem-nome";
}

/** Constrói a lista de clientes a partir do campo client dos lançamentos */
export function buildClientsFromEntries(entries: Entry[]): CrmClient[] {
  const map = new Map<
    string,
    {
      name: string;
      dates: string[];
      income: number;
      expense: number;
      count: number;
    }
  >();

  for (const e of entries) {
    const name = (e.client || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const cur = map.get(key) ?? {
      name,
      dates: [],
      income: 0,
      expense: 0,
      count: 0,
    };
    cur.dates.push(e.entry_date);
    cur.count += 1;
    const val = Number(e.value) || 0;
    if (e.type === "income") cur.income += val;
    else cur.expense += val;
    // mantém capitalização do nome mais recente
    cur.name = name;
    map.set(key, cur);
  }

  const list: CrmClient[] = [];
  for (const [, v] of map) {
    const sorted = [...v.dates].sort();
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1] ?? null;
    let status: ClientStatus = "active";
    if (v.income >= 5000) status = "vip";
    else if (v.count <= 1 && v.income < 100) status = "lead";
    // inativo se última movimentação há mais de 180 dias
    if (last) {
      const days =
        (Date.now() - new Date(`${last}T00:00`).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 180) status = "inactive";
    }
    list.push({
      id: slugify(v.name),
      name: v.name,
      first_contact_date: first,
      last_entry_date: last,
      total_income: v.income,
      total_expense: v.expense,
      entries_count: v.count,
      status,
    });
  }

  return list.sort((a, b) => a.name.localeCompare(b.name, "pt"));
}

export function getClientEntries(entries: Entry[], clientName: string): Entry[] {
  const key = clientName.trim().toLowerCase();
  return entries.filter((e) => (e.client || "").trim().toLowerCase() === key);
}

export function findClientById(clients: CrmClient[], id: string): CrmClient | undefined {
  return clients.find((c) => c.id === id);
}

export const CRM_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Ativo",
  lead: "Lead",
  vip: "VIP",
  inactive: "Inativo",
};
