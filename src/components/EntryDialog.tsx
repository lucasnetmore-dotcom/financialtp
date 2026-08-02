import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EntryInput } from "@/lib/data";
import { PAYMENTS, todayISO, type Entry } from "@/lib/finance";

const emptyForm = (preset?: "withdrawal"): EntryInput => ({
  id: crypto.randomUUID(),
  type: preset ? "expense" : "income",
  value: 0,
  entry_date: todayISO(),
  category: preset ? "Retirada de caixa" : "",
  description: preset ? "Retirada de caixa" : "",
  payment: "",
  client: "",
  notes: "",
  baseUpdatedAt: null,
});

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function EntryDialog({
  open,
  entry,
  preset,
  saving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  entry: Entry | null;
  preset?: "withdrawal" | undefined;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: EntryInput) => void;
}) {
  const [form, setForm] = useState<EntryInput>(emptyForm());

  useEffect(() => {
    if (!open) return;
    setForm(
      entry
        ? {
            id: entry.id,
            type: entry.type,
            value: Number(entry.value),
            entry_date: entry.entry_date,
            category: entry.category,
            description: entry.description,
            payment: entry.payment,
            client: entry.client,
            notes: entry.notes,
            baseUpdatedAt: entry.updated_at,
          }
        : emptyForm(preset),
    );
  }, [open, entry, preset]);

  const set = <K extends keyof EntryInput>(key: K, value: EntryInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {entry
              ? "Editar lançamento"
              : preset
                ? "Nova retirada de caixa"
                : "Novo lançamento"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              ...form,
              category: form.category.trim() || "Geral",
              description: form.description.trim(),
              client: form.client.trim(),
              notes: form.notes.trim(),
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="type">Tipo</Label>
            <select
              id="type"
              className={selectClass}
              value={form.type}
              onChange={(e) => set("type", e.target.value as Entry["type"])}
            >
              <option value="income">Entrada</option>
              <option value="expense">Saída</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="value">Valor (€)</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              min="0"
              required
              value={form.value || ""}
              onChange={(e) => set("value", Number(e.target.value))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              required
              value={form.entry_date}
              onChange={(e) => set("entry_date", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="category">Categoria</Label>
            <Input
              id="category"
              placeholder="Vendas, Rendas, Salários…"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              required
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="payment">Pagamento</Label>
            <select
              id="payment"
              className={selectClass}
              value={form.payment}
              onChange={(e) => set("payment", e.target.value)}
            >
              <option value="">—</option>
              {PAYMENTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client">Cliente / fornecedor</Label>
            <Input
              id="client"
              value={form.client}
              onChange={(e) => set("client", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
