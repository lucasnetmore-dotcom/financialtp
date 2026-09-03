import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { UserPlus, Users } from "lucide-react";
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

export function EntryDialog({ open, entry, preset, saving, onOpenChange, onSubmit }: {
  open: boolean; entry: Entry | null; preset?: "withdrawal"; saving: boolean;
  onOpenChange: (open: boolean) => void; onSubmit: (input: EntryInput) => void;
}) {
  const [form, setForm] = useState<EntryInput>(emptyForm());
  const [clients, setClients] = useState<Client[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", nif: "" });
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [clientListOpen, setClientListOpen] = useState(false);
  const [clientActive, setClientActive] = useState(0);

  async function loadClients() {
    setClientLoading(true);
    const { data, error } = await supabase.from("clients").select("id,name,email,phone,nif").order("name");
    if (error) { toast.error("Não foi possível carregar os clientes."); setClients([]); }
    else setClients((data ?? []) as Client[]);
    setClientLoading(false);
  }

  useEffect(() => {
    if (!open) return;
    setForm(entry ? {
      id: entry.id, type: entry.type, value: Number(entry.value), entry_date: entry.entry_date,
      category: entry.category, description: entry.description, payment: entry.payment,
      client: entry.client, notes: entry.notes, baseUpdatedAt: entry.updated_at,
    } : emptyForm(preset));
    setClientQuery(entry?.client ?? "");
    setClientListOpen(false);
    setClientActive(0);
    void loadClients();
  }, [open, entry, preset]);

  const set = <K extends keyof EntryInput>(key: K, value: EntryInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const selectedClient = clients.find((client) => client.name.trim().toLowerCase() === form.client.trim().toLowerCase());

  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const query = normalize(clientQuery.trim());
  const filteredClients = query
    ? clients.filter((client) =>
        normalize(client.name).includes(query) ||
        (client.phone ?? "").toLowerCase().includes(query) ||
        (client.nif ?? "").toLowerCase().includes(query) ||
        (client.email ?? "").toLowerCase().includes(query))
    : clients;

  function pickClient(client: Client) {
    set("client", client.name);
    setClientQuery(client.name);
    setClientListOpen(false);
  }

  function onClientKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!clientListOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setClientListOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setClientActive((i) => Math.min(i + 1, filteredClients.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setClientActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && clientListOpen && filteredClients[clientActive]) { e.preventDefault(); pickClient(filteredClients[clientActive]); }
    else if (e.key === "Escape") { setClientListOpen(false); }
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
            <div className="flex flex-wrap items-center justify-between gap-3"><div><Label>Cliente</Label><p className="mt-1 text-xs text-muted-foreground">O lançamento fica associado à ficha do cliente e entra no histórico de gastos.</p></div><Link to="/crm" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"><Users className="size-3.5" /> Gerir clientes</Link></div>
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder={clientLoading ? "A carregar clientes…" : "Pesquisar cliente por nome, telefone, NIF ou email…"}
                  value={clientQuery}
                  disabled={clientLoading}
                  onFocus={() => { setClientListOpen(true); setClientActive(0); }}
                  onBlur={() => setTimeout(() => setClientListOpen(false), 120)}
                  onChange={(e) => { setClientQuery(e.target.value); setClientListOpen(true); setClientActive(0); }}
                  onKeyDown={onClientKeyDown}
                />
                {clientListOpen && !clientLoading && (
                  <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg" role="listbox">
                    {filteredClients.length === 0 && (
                      <li className="px-3 py-2 text-sm text-muted-foreground">
                        Nenhum cliente encontrado para “{clientQuery}”. Use o botão <strong className="text-foreground">Novo</strong> para criar a ficha.
                      </li>
                    )}
                    {filteredClients.map((client, index) => (
                      <li key={client.id} role="option" aria-selected={client.id === selectedClient?.id}>
                        <button
                          type="button"
                          className={`w-full rounded-sm px-3 py-2 text-left text-sm transition-colors ${index === clientActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"}`}
                          onMouseDown={(e) => { e.preventDefault(); pickClient(client); }}
                          onMouseEnter={() => setClientActive(index)}
                        >
                          <span className="block font-medium">{client.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[client.phone, client.nif && `NIF ${client.nif}`, client.email].filter(Boolean).join(" · ") || "Sem dados de contacto"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button type="button" variant="outline" onClick={openNewClient}><UserPlus className="size-4" /><span className="hidden sm:inline">Novo</span></Button>
            </div>
            {selectedClient && <p className="mt-2 text-xs text-muted-foreground">Ficha selecionada: <strong className="text-foreground">{selectedClient.name}</strong>{selectedClient.phone ? ` · ${selectedClient.phone}` : ""}{selectedClient.nif ? ` · NIF ${selectedClient.nif}` : ""}{selectedClient.email ? ` · ${selectedClient.email}` : ""}</p>}
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
