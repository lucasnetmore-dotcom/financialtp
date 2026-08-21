import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

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
import { supabase } from "@/integrations/supabase/client";
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

type Client = { id: string; name: string; email: string | null; phone: string | null; nif: string | null };

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
  const [clients, setClients] = useState<Client[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", nif: "" });
  const [creatingClient, setCreatingClient] = useState(false);

  async function loadClients() {
    setClientLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id,name,email,phone,nif")
      .order("name");
    if (error) {
      toast.error("Não foi possível carregar os clientes.");
      setClients([]);
    } else {
      setClients((data ?? []) as Client[]);
    }
    setClientLoading(false);
  }

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
    void loadClients();
  }, [open, entry, preset]);

  const set = <K extends keyof EntryInput>(key: K, value: EntryInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectedClient = clients.find(
    (client) => client.name.trim().toLowerCase() === form.client.trim().toLowerCase(),
  );

  async function createClient() {
    if (!newClient.name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setCreatingClient(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("Sessão terminada. Entre novamente na sua conta.");
      setCreatingClient(false);
      return;
    }

    const { data, error } = await supabase
      .from("clients")
      .insert({
        user_id: userId,
        name: newClient.name.trim(),
        email: newClient.email.trim() || null,
        phone: newClient.phone.trim() || null,
        nif: newClient.nif.trim() || null,
      })
      .select("id,name,email,phone,nif")
      .single();

    if (error) {
      toast.error(error.message.includes("clients_user_name") ? "Já existe um cliente com este nome." : "Não foi possível criar o cliente.");
    } else {
      const client = data as Client;
      setClients((current) => [...current, client].sort((a, b) => a.name.localeCompare(b.name)));
      set("client", client.name);
      setShowNewClient(false);
      setNewClient({ name: "", email: "", phone: "", nif: "" });
      toast.success("Ficha do cliente criada.");
    }
    setCreatingClient(false);
  }

  function submit() {
    const requiresClient = !preset;
    if (requiresClient && !selectedClient) {
      toast.error("Selecione um cliente cadastrado ou crie uma nova ficha antes de guardar o lançamento.");
      return;
    }

    onSubmit({
      ...form,
      category: form.category.trim() || "Geral",
      description: form.description.trim(),
      client: selectedClient?.name ?? "",
      notes: form.notes.trim(),
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {entry ? "Editar lançamento" : preset ? "Nova retirada de caixa" : "Novo lançamento"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="type">Tipo</Label>
              <select id="type" className={selectClass} value={form.type} onChange={(e) => set("type", e.target.value as Entry["type"])}>
                <option value="income">Entrada</option>
                <option value="expense">Saída</option>
              </select>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="value">Valor (€)</Label><Input id="value" type="number" step="0.01" min="0" required value={form.value || ""} onChange={(e) => set("value", Number(e.target.value))} /></div>
            <div className="grid gap-1.5"><Label htmlFor="date">Data</Label><Input id="date" type="date" required value={form.entry_date} onChange={(e) => set("entry_date", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="category">Categoria</Label><Input id="category" placeholder="Vendas, Rendas, Salários…" value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
            <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="description">Descrição</Label><Input id="description" required value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="payment">Pagamento</Label><select id="payment" className={selectClass} value={form.payment} onChange={(e) => set("payment", e.target.value)}><option value="">—</option>{PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>

            <div className="sm:col-span-2 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label htmlFor="client">Cliente</Label>
                  <p className="mt-1 text-xs text-muted-foreground">O lançamento fica associado à ficha do cliente e entra no histórico de gastos.</p>
                </div>
                <Link to="/crm" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"><Users className="size-3.5" /> Gerir clientes</Link>
              </div>
              <div className="mt-3 flex gap-2">
                <select id="client" className={selectClass} value={selectedClient?.id ?? ""} disabled={clientLoading} onChange={(e) => { const client = clients.find((item) => item.id === e.target.value); set("client", client?.name ?? ""); }}>
                  <option value="">{clientLoading ? "A carregar clientes…" : "Selecione um cliente…"}</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.nif ? ` · ${client.nif}` : ""}</option>)}
                </select>
                <Button type="button" variant="outline" onClick={() => setShowNewClient(true)} title="Criar ficha de cliente"><UserPlus className="size-4" /><span className="hidden sm:inline">Novo</span></Button>
              </div>
              {selectedClient && <p className="mt-2 text-xs text-muted-foreground">Ficha selecionada: <strong className="text-foreground">{selectedClient.name}</strong>{selectedClient.email ? ` · ${selectedClient.email}` : ""}</p>}
            </div>

            <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="notes">Observações</Label><Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
            <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving || clientLoading}>{saving ? "A guardar…" : "Guardar lançamento"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {showNewClient && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={() => setShowNewClient(false)}>
          <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Criar ficha de cliente</h2><p className="mt-1 text-sm text-muted-foreground">Depois de criar, o cliente já fica selecionado neste lançamento.</p></div><Button type="button" variant="ghost" onClick={() => setShowNewClient(false)}>Fechar</Button></div>
            <div className="mt-5 grid gap-4">
              <div className="grid gap-1.5"><Label>Nome *</Label><Input autoFocus value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Telefone</Label><Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>NIF</Label><Input value={newClient.nif} onChange={(e) => setNewClient({ ...newClient, nif: e.target.value })} /></div>
              <Button type="button" disabled={creatingClient} onClick={() => void createClient()}>{creatingClient ? "A criar…" : "Criar ficha e selecionar"}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
