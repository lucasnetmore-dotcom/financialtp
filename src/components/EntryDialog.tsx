import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { EntryInput } from "@/lib/data";
import { PAYMENTS, todayISO, type Entry } from "@/lib/finance";

const emptyForm = (preset?: "withdrawal"): EntryInput => ({
  id: crypto.randomUUID(), type: preset ? "expense" : "income", value: 0, entry_date: todayISO(),
  category: preset ? "Retirada de caixa" : "", description: preset ? "Retirada de caixa" : "",
  payment: "", client: "", notes: "", baseUpdatedAt: null,
});

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
type Client = { id: string; name: string; email: string | null; phone: string | null; nif: string | null };

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function EntryDialog({ open, entry, preset, saving, onOpenChange, onSubmit }: {
  open: boolean; entry: Entry | null; preset?: "withdrawal"; saving: boolean;
  onOpenChange: (open: boolean) => void; onSubmit: (input: EntryInput) => void;
}) {
  const [form, setForm] = useState<EntryInput>(emptyForm());
  const [clients, setClients] = useState<Client[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [activeClientIndex, setActiveClientIndex] = useState(0);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", nif: "" });
  const [creatingClient, setCreatingClient] = useState(false);

  async function loadClients() {
    setClientLoading(true);
    const { data, error } = await supabase.from("clients").select("id,name,email,phone,nif").order("name");
    if (error) { toast.error("Não foi possível carregar os clientes."); setClients([]); }
    else setClients((data ?? []) as Client[]);
    setClientLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    const initialForm = entry ? {
      id: entry.id, type: entry.type, value: Number(entry.value), entry_date: entry.entry_date,
      category: entry.category, description: entry.description, payment: entry.payment,
      client: entry.client, notes: entry.notes, baseUpdatedAt: entry.updated_at,
    } : emptyForm(preset);
    setForm(initialForm);
    setClientSearch(initialForm.client);
    setClientOpen(false);
    setActiveClientIndex(0);
    void loadClients();
  }, [open, entry, preset]);

  const set = <K extends keyof EntryInput>(key: K, value: EntryInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const selectedClient = clients.find((client) => client.name.trim().toLowerCase() === form.client.trim().toLowerCase());

  const filteredClients = useMemo(() => {
    const query = normalizeSearch(clientSearch);
    if (!query) return clients.slice(0, 10);
    return clients
      .filter((client) => normalizeSearch(client.name).includes(query))
      .slice(0, 10);
  }, [clients, clientSearch]);

  function selectClient(client: Client) {
    set("client", client.name);
    setClientSearch(client.name);
    setClientOpen(false);
    setActiveClientIndex(0);
  }

  function handleClientSearch(value: string) {
    setClientSearch(value);
    setClientOpen(true);
    setActiveClientIndex(0);
    if (!selectedClient || normalizeSearch(value) !== normalizeSearch(selectedClient.name)) {
      set("client", "");
    }
  }

  function handleClientKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!clientOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setClientOpen(true);
      return;
    }
    if (!clientOpen) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveClientIndex((index) => Math.min(index + 1, Math.max(0, filteredClients.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveClientIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && filteredClients[activeClientIndex]) {
      event.preventDefault();
      selectClient(filteredClients[activeClientIndex]);
    } else if (event.key === "Escape") {
      setClientOpen(false);
    }
  }

  function openNewClient() {
    onOpenChange(false);
    setShowNewClient(true);
  }

  function closeNewClient(reopenEntry = true) {
    setShowNewClient(false);
    if (reopenEntry) onOpenChange(true);
  }

  async function createClient() {
    const name = newClient.name.trim();
    const phone = newClient.phone.trim();

    if (!name) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (!phone) {
      toast.error("Informe o número de telefone do cliente.");
      return;
    }

    setCreatingClient(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { toast.error("Sessão terminada. Entre novamente na sua conta."); setCreatingClient(false); return; }
    const { data, error } = await supabase.from("clients").insert({
      user_id: userId,
      name,
      email: newClient.email.trim() || null,
      phone,
      nif: newClient.nif.trim() || null,
    }).select("id,name,email,phone,nif").single();
    if (error) {
      toast.error(error.message.includes("clients_user_name") ? "Já existe um cliente com este nome." : "Não foi possível criar o cliente.");
    } else {
      const client = data as Client;
      setClients((current) => [...current, client].sort((a, b) => a.name.localeCompare(b.name)));
      set("client", client.name);
      setClientSearch(client.name);
      setNewClient({ name: "", email: "", phone: "", nif: "" });
      toast.success("Ficha do cliente criada.");
      closeNewClient(true);
    }
    setCreatingClient(false);
  }

  function submit() {
    if (!preset && !selectedClient) {
      toast.error("Selecione um cliente cadastrado ou crie uma nova ficha antes de guardar o lançamento."); return;
    }
    onSubmit({ ...form, category: form.category.trim() || "Geral", description: form.description.trim(), client: selectedClient?.name ?? "", notes: form.notes.trim() });
  }

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{entry ? "Editar lançamento" : preset ? "Nova retirada de caixa" : "Novo lançamento"}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="grid gap-1.5"><Label>Tipo</Label><select className={selectClass} value={form.type} onChange={(e) => set("type", e.target.value as Entry["type"])}><option value="income">Entrada</option><option value="expense">Saída</option></select></div>
          <div className="grid gap-1.5"><Label>Valor (€)</Label><Input type="number" step="0.01" min="0" required value={form.value || ""} onChange={(e) => set("value", Number(e.target.value))} /></div>
          <div className="grid gap-1.5"><Label>Data</Label><Input type="date" required value={form.entry_date} onChange={(e) => set("entry_date", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Categoria</Label><Input placeholder="Vendas, Rendas, Salários…" value={form.category} onChange={(e) => set("category", e.target.value)} /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label>Descrição</Label><Input required value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Pagamento</Label><select className={selectClass} value={form.payment} onChange={(e) => set("payment", e.target.value)}><option value="">—</option>{PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
          <div className="sm:col-span-2 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><Label>Cliente</Label><p className="mt-1 text-xs text-muted-foreground">Digite o nome para encontrar rapidamente uma ficha já cadastrada.</p></div><Link to="/crm" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"><Users className="size-3.5" /> Gerir clientes</Link></div>
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={clientSearch}
                  disabled={clientLoading}
                  placeholder={clientLoading ? "A carregar clientes…" : "Pesquisar cliente pelo nome…"}
                  className="pl-9"
                  autoComplete="off"
                  onFocus={() => setClientOpen(true)}
                  onBlur={() => window.setTimeout(() => setClientOpen(false), 120)}
                  onChange={(e) => handleClientSearch(e.target.value)}
                  onKeyDown={handleClientKeyDown}
                />
                {clientOpen && !clientLoading && (
                  <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl">
                    {filteredClients.length > 0 ? filteredClients.map((client, index) => (
                      <button
                        key={client.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectClient(client); }}
                        className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${index === activeClientIndex ? "bg-accent" : "hover:bg-accent/70"}`}
                      >
                        <div className="text-sm font-semibold text-foreground">{client.name}</div>
                        {(client.phone || client.nif || client.email) && (
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {[client.phone, client.nif ? `NIF ${client.nif}` : null, client.email].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </button>
                    )) : (
                      <div className="px-3 py-3 text-sm text-muted-foreground">Nenhum cliente encontrado com esse nome.</div>
                    )}
                  </div>
                )}
              </div>
              <Button type="button" variant="outline" onClick={openNewClient}><UserPlus className="size-4" /><span className="hidden sm:inline">Novo</span></Button>
            </div>
            {selectedClient && <p className="mt-2 text-xs text-muted-foreground">Ficha selecionada: <strong className="text-foreground">{selectedClient.name}</strong>{selectedClient.email ? ` · ${selectedClient.email}` : ""}</p>}
          </div>
          <div className="grid gap-1.5 sm:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving || clientLoading}>{saving ? "A guardar…" : "Guardar lançamento"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={showNewClient} onOpenChange={(value) => value ? setShowNewClient(true) : closeNewClient(true)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Criar ficha de cliente</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Preencha os dados. Nome e telefone são obrigatórios. Email e NIF são opcionais.</p>
        <div className="grid gap-4 pt-2">
          <div className="grid gap-1.5"><Label htmlFor="new-client-name">Nome *</Label><Input id="new-client-name" autoFocus required value={newClient.name} onChange={(e) => setNewClient((v) => ({ ...v, name: e.target.value }))} /></div>
          <div className="grid gap-1.5"><Label htmlFor="new-client-email">Email</Label><Input id="new-client-email" type="email" value={newClient.email} onChange={(e) => setNewClient((v) => ({ ...v, email: e.target.value }))} /></div>
          <div className="grid gap-1.5"><Label htmlFor="new-client-phone">Telefone *</Label><Input id="new-client-phone" required value={newClient.phone} onChange={(e) => setNewClient((v) => ({ ...v, phone: e.target.value }))} /></div>
          <div className="grid gap-1.5"><Label htmlFor="new-client-nif">NIF</Label><Input id="new-client-nif" value={newClient.nif} onChange={(e) => setNewClient((v) => ({ ...v, nif: e.target.value }))} /></div>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => closeNewClient(true)}>Cancelar</Button><Button type="button" disabled={creatingClient} onClick={() => void createClient()}>{creatingClient ? "A criar…" : "Criar ficha e selecionar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
