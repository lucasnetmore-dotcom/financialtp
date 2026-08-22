import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarDays, CircleDollarSign, Settings2, UsersRound, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/gestao')({ component: Gestao });

const modules = [
  { icon: CalendarDays, title: 'Agenda & serviços', text: 'Marcações, serviços, preços, duração e recebimentos num único fluxo.', href: '/crm' },
  { icon: UsersRound, title: 'Clientes & recorrência', text: 'Histórico, total gasto, última visita e relacionamento com clientes.', href: '/crm' },
  { icon: CircleDollarSign, title: 'Caixa & previsões', text: 'Receitas, despesas, metas, projeções e alertas inteligentes.', href: '/painel' },
  { icon: WalletCards, title: 'Contas recorrentes', text: 'Estrutura pronta para despesas fixas e previsibilidade mensal.', href: '/painel' },
];

function Gestao(){
 return <main className="min-h-screen bg-background px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl">
  <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Finance Flow</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Gestão do negócio</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">O centro operacional que liga clientes, agenda e dinheiro. Sem depender de IA paga.</p></div><Button asChild><Link to="/comando">Abrir Central de Gestão</Link></Button></div>
  <section className="grid gap-4 md:grid-cols-2">{modules.map(({icon:Icon,title,text,href})=><Link key={title} to={href} className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5"/></div><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p><div className="mt-5 text-sm font-semibold text-primary">Abrir módulo →</div></Link>)}</section>
  <section className="mt-5 rounded-2xl border bg-card p-5"><div className="flex gap-3"><Settings2 className="mt-0.5 size-5 text-primary"/><div><h2 className="font-bold">Base preparada para crescer</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Serviços configuráveis, equipa, comissões, despesas recorrentes, configurações da empresa e estados de pagamento passam a ter estrutura própria no banco de dados, mantendo o mesmo utilizador e a mesma fonte de verdade.</p></div></div></section>
 </div></main>
}