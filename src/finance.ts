export type EntryType = "income" | "expense";

export interface Entry {
  id: string;
  user_id: string;
  type: EntryType;
  value: number;
  entry_date: string;
  category: string;
  description: string;
  payment: string;
  client: string;
  client_id?: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  user_id: string;
  monthly_goal: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  company_name: string;
  owner_name: string | null;
  plan: "free" | "pro" | "business";
  created_at: string;
  updated_at: string;
}

export type ClientStatus = "active" | "inactive" | "lead" | "vip";

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  status: ClientStatus;
  tags: string[];
  first_contact_date: string;
  created_at: string;
  updated_at: string;
}

export interface ClientStats {
  client_id: string;
  user_id: string;
  name: string;
  first_contact_date: string;
  total_income: number;
  total_expense: number;
  entries_count: number;
  last_entry_date: string | null;
}

export const CLIENT_STATUSES: { value: ClientStatus; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "lead", label: "Lead" },
  { value: "vip", label: "VIP" },
  { value: "inactive", label: "Inativo" },
];

export const money = (n: number, currency = "EUR") =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(n || 0);

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const monthISO = () => new Date().toISOString().slice(0, 7);

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00`).toLocaleDateString("pt-PT");

export function totals(list: Entry[]) {
  const income = list
    .filter((x) => x.type === "income")
    .reduce((s, x) => s + Number(x.value), 0);
  const expense = list
    .filter((x) => x.type === "expense")
    .reduce((s, x) => s + Number(x.value), 0);
  return { income, expense, balance: income - expense };
}

export function lastDays(entries: Entry[], days = 7) {
  const out: { date: string; income: number; expense: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const t = totals(entries.filter((x) => x.entry_date === date));
    out.push({ date, income: t.income, expense: t.expense });
  }
  return out;
}

export const PAYMENTS = [
  "Numerário",
  "Multibanco",
  "Transferência",
  "MB Way",
  "Cartão de crédito",
  "Outro",
];
