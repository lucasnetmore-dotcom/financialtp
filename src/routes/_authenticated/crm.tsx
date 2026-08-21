import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Mail, Pencil, Phone, Plus, Search, Trash2, UserRound, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/finance";
import { useAuthUser } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/crm")({ component: CrmRoute });

type Client = { id: string; name: string; email: string | null; phone: string | null; nif: string | null; notes: string | null; created_at: string; };
type Appointment = { id: string; client_id: string; title: string; starts_at: string; ends_at: string | null; status: string; notes: string | null; };
type Entry = { client: string | null; type: string; value: number };

function CrmRoute() {
  const { userId, ready } = useAuthUser();
  if (!ready) return <div className="flex min-h-screen items-center justify-center">A carregar…</div>;
  if (!userId) return null;
  return <Crm userId={userId} />;
}

function Crm({ userId }: { userId: string }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"clients" | "agenda">("clients");
  const [selected, setSelected] = useState<Client | null>(null);
  const [showClient, setShowClient] = useState(false);
  const [showAppointment, setShowAppointment] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [c, a, e] = await Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("appointments").select("*").order("starts_at"),
      supabase.from("entries").select("client,type,value"),
    ]);
    if (c.error || a.error || e.error) toast.error("Não foi possível carregar o CRM.");
    setClients((c.data ?? []) as Client[]);
    setAppointments((a.data ?? []) as Appointment[]);
    setEntries((e.data ?? []).map((x) => ({ ...x, value: Number(x.value) })) as Entry[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [userId]);

  const filtered = useMemo(() => clients.filter((c) => [c.name, c.email, c.phone, c.nif].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())), [clients, search]);
  const spent = (client: Client) => entries.filter((e) => (e.client ?? "").trim().toLowerCase() === client.name.trim().toLowerCase() && e.type === "income").reduce((s, e) => s + e.value, 0);
  const nextAppointments = appointments.filter((a) => a.status !== "cancelled" && new Date(a.starts_at) >= new Date()).sort((a,b) => +new Date(a.starts_at)-+new Date(b.starts_at));

  async function deleteClient(id: string) {
    if (!confirm("Eliminar este cliente e os seus agendamentos?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error("Não foi possível eliminar."); else { toast.success("Cliente eliminado."); setSelected(null); await load(); }
  }

  return <div className="min-h-screen bg-background px-5 py-7 lg:px-10 lg:py-9">
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div><p className="eyebrow">Gestão de relacionamento</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight">CRM</h1><p className="mt-1 text-sm text-muted-foreground">Clientes, histórico financeiro e agenda num só lugar.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setTab("agenda")}><CalendarDays className="size-4"/> Agenda</Button><Button onClick={() => { setSelected(null); setShowClient(true); }}><Plus className="size-4"/> Novo cliente</Button></div>
      </header>

      <div className="mb-5 flex gap-2 border-b border-border"><button className={`px-3 py-3 text-sm font-medium ${tab === "clients" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`} onClick={() => setTab("clients")}><Users className="mr-2 inline size-4"/>Clientes ({clients.length})</button><button className={`px-3 py-3 text-sm font-medium ${tab === "agenda" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`} onClick={() => setTab("agenda")}><CalendarDays className="mr-2 inline size-4"/>Agenda ({nextAppointments.length})</button></div>

      {tab === "clients" ? <>
        <div className="mb-5 relative max-w-xl"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input className="pl-9" placeholder="Pesquisar nome, email, telefone ou NIF…" value={search} onChange={e => setSearch(e.target.value)}/></div>
        {loading ? <div className="panel p-8 text-sm text-muted-foreground">A carregar clientes…</div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map(c => <button key={c.id} onClick={() => setSelected(c)} className="panel p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40"><div className="flex items-start justify-between"><div className="flex gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5"/></span><div><strong>{c.name}</strong><p className="mt-1 text-xs text-muted-foreground">{c.phone || c.email || "Sem contacto"}</p></div></div><span className="numeric text-sm font-semibold">{money(spent(c))}</span></div><div className="mt-4 flex gap-4 text-xs text-muted-foreground"><span>{appointments.filter(a => a.client_id === c.id).length} agendamentos</span><span>{c.nif ? `NIF ${c.nif}` : "NIF não informado"}</span></div></button>)}</div>}
      </> : <Agenda appointments={nextAppointments} clients={clients} onNew={() => setShowAppointment(true)} onRefresh={load}/>} 

      {selected && <ClientPanel client={selected} total={spent(selected)} appointments={appointments.filter(a => a.client_id === selected.id)} onClose={() => setSelected(null)} onEdit={() => setShowClient(true)} onDelete={() => void deleteClient(selected.id)} onNewAppointment={() => setShowAppointment(true)}/>} 
      {showClient && <ClientModal userId={userId} client={selected} onClose={() => setShowClient(false)} onSaved={() => { setShowClient(false); void load(); }}/>} 
      {showAppointment && <AppointmentModal userId={userId} clients={clients} clientId={selected?.id} onClose={() => setShowAppointment(false)} onSaved={() => { setShowAppointment(false); void load(); }}/>} 
    </div>
  </div>;
}

function Agenda({ appointments, clients, onNew, onRefresh }: { appointments: Appointment[]; clients: Client[]; onNew: () => void; onRefresh: () => Promise<void> }) { return <div className="grid gap-3 lg:grid-cols-2">{appointments.length === 0 ? <div className="panel p-8 text-center lg:col-span-2"><CalendarDays className="mx-auto size-8 text-muted-foreground"/><p className="mt-3 font-medium">Nenhum atendimento agendado</p><Button className="mt-4" onClick={onNew}><Plus className="size-4"/> Agendar atendimento</Button></div> : appointments.map(a => { const c=clients.find(x=>x.id===a.client_id); return <div key={a.id} className="panel flex items-center justify-between gap-4 p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{new Date(a.starts_at).toLocaleDateString("pt-PT",{weekday:"short",day:"2-digit",month:"short"})} · {new Date(a.starts_at).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})}</p><h3 className="mt-1 font-semibold">{a.title}</h3><p className="text-sm text-muted-foreground">{c?.name ?? "Cliente removido"}</p></div><Button variant="ghost" size="icon" onClick={async()=>{await supabase.from("appointments").delete().eq("id",a.id); await onRefresh();}}><Trash2 className="size-4"/></Button></div>})}</div> }

function ClientPanel({client,total,appointments,onClose,onEdit,onDelete,onNewAppointment}:{client:Client;total:number;appointments:Appointment[];onClose:()=>void;onEdit:()=>void;onDelete:()=>void;onNewAppointment:()=>void}) { return <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}><aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto bg-background p-6 shadow-2xl" onClick={e=>e.stopPropagation()}><div className="flex justify-between"><div><p className="eyebrow">Ficha do cliente</p><h2 className="mt-1 text-2xl font-bold">{client.name}</h2></div><Button variant="ghost" size="icon" onClick={onClose}><X/></Button></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="panel p-4"><p className="text-xs text-muted-foreground">Total gasto</p><strong className="numeric mt-1 block text-xl">{money(total)}</strong></div><div className="panel p-4"><p className="text-xs text-muted-foreground">Agendamentos</p><strong className="mt-1 block text-xl">{appointments.length}</strong></div></div><div className="mt-6 space-y-3 text-sm">{client.email&&<p><Mail className="mr-2 inline size-4"/>{client.email}</p>}{client.phone&&<p><Phone className="mr-2 inline size-4"/>{client.phone}</p>}{client.nif&&<p>NIF: {client.nif}</p>}{client.notes&&<p className="rounded-xl bg-muted p-3">{client.notes}</p>}</div><div className="mt-7 flex gap-2"><Button onClick={onNewAppointment}><CalendarDays className="size-4"/> Agendar</Button><Button variant="outline" onClick={onEdit}><Pencil className="size-4"/> Editar</Button><Button variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 className="size-4"/> Eliminar</Button></div><h3 className="mt-8 font-semibold">Próximos atendimentos</h3><div className="mt-3 space-y-2">{appointments.filter(a=>new Date(a.starts_at)>=new Date()).sort((a,b)=>+new Date(a.starts_at)-+new Date(b.starts_at)).map(a=><div key={a.id} className="rounded-xl border p-3 text-sm">{new Date(a.starts_at).toLocaleString("pt-PT")} · {a.title}</div>)}</div></aside></div> }

function ClientModal({userId,client,onClose,onSaved}:{userId:string;client:Client|null;onClose:()=>void;onSaved:()=>void}) { const [form,setForm]=useState({name:client?.name??"",email:client?.email??"",phone:client?.phone??"",nif:client?.nif??"",notes:client?.notes??""}); const [saving,setSaving]=useState(false); async function save(){if(!form.name.trim())return toast.error("Informe o nome do cliente.");setSaving(true);const q=client?supabase.from("clients").update(form).eq("id",client.id):supabase.from("clients").insert({...form,user_id:userId});const {error}=await q;if(error)toast.error(error.message.includes("clients_user_name")?"Já existe um cliente com este nome.":"Não foi possível guardar.");else{toast.success("Cliente guardado.");onSaved();}setSaving(false);} return <Modal title={client?"Editar cliente":"Novo cliente"} onClose={onClose}><Field label="Nome *" value={form.name} onChange={v=>setForm({...form,name:v})}/><Field label="Email" value={form.email} onChange={v=>setForm({...form,email:v})}/><Field label="Telefone" value={form.phone} onChange={v=>setForm({...form,phone:v})}/><Field label="NIF" value={form.nif} onChange={v=>setForm({...form,nif:v})}/><div className="space-y-2"><Label>Observações</Label><textarea className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div><Button className="mt-5 w-full" disabled={saving} onClick={save}>{saving?"A guardar…":"Guardar cliente"}</Button></Modal> }

function AppointmentModal({userId,clients,clientId,onClose,onSaved}:{userId:string;clients:Client[];clientId?:string;onClose:()=>void;onSaved:()=>void}) { const [form,setForm]=useState({client_id:clientId??clients[0]?.id??"",title:"Atendimento",date:"",time:"",notes:""}); const [saving,setSaving]=useState(false); async function save(){if(!form.client_id||!form.date||!form.time)return toast.error("Preencha cliente, data e hora.");setSaving(true);const {error}=await supabase.from("appointments").insert({user_id:userId,client_id:form.client_id,title:form.title,starts_at:new Date(`${form.date}T${form.time}`).toISOString(),notes:form.notes||null});if(error)toast.error("Não foi possível agendar.");else{toast.success("Atendimento agendado.");onSaved();}setSaving(false);}return <Modal title="Novo atendimento" onClose={onClose}><div className="space-y-2"><Label>Cliente *</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><Field label="Serviço / título" value={form.title} onChange={v=>setForm({...form,title:v})}/><div className="grid grid-cols-2 gap-3"><Field label="Data *" type="date" value={form.date} onChange={v=>setForm({...form,date:v})}/><Field label="Hora *" type="time" value={form.time} onChange={v=>setForm({...form,time:v})}/></div><Button className="mt-5 w-full" disabled={saving} onClick={save}>{saving?"A guardar…":"Agendar"}</Button></Modal> }

function Field({label,value,onChange,type="text"}:{label:string;value:string;onChange:(v:string)=>void;type?:string}) { return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={e=>onChange(e.target.value)}/></div> }
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) { return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-2xl border bg-background p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><Button variant="ghost" size="icon" onClick={onClose}><X/></Button></div><div className="mt-5 space-y-4">{children}</div></div></div> }
