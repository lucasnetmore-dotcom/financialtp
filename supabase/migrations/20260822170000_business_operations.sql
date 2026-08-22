-- Finance Flow: operational foundation (no Stripe dependency)
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0 check (price >= 0),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists services_user_idx on public.services(user_id, active);
alter table public.services enable row level security;
drop policy if exists services_owner on public.services;
create policy services_owner on public.services for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  commission_percent numeric(5,2) not null default 0 check (commission_percent between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists team_members_user_idx on public.team_members(user_id, active);
alter table public.team_members enable row level security;
drop policy if exists team_members_owner on public.team_members;
create policy team_members_owner on public.team_members for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  category text,
  due_day integer not null default 1 check (due_day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists recurring_expenses_user_idx on public.recurring_expenses(user_id, active);
alter table public.recurring_expenses enable row level security;
drop policy if exists recurring_expenses_owner on public.recurring_expenses;
create policy recurring_expenses_owner on public.recurring_expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.business_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  nif text,
  phone text,
  email text,
  address text,
  currency text not null default 'EUR',
  monthly_goal numeric(12,2) not null default 0,
  appointment_reminder_hours integer not null default 24,
  updated_at timestamptz not null default now()
);
alter table public.business_settings enable row level security;
drop policy if exists business_settings_owner on public.business_settings;
create policy business_settings_owner on public.business_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Extend appointments without breaking existing CRM.
alter table public.appointments add column if not exists service_id uuid references public.services(id) on delete set null;
alter table public.appointments add column if not exists team_member_id uuid references public.team_members(id) on delete set null;
alter table public.appointments add column if not exists price numeric(12,2);
alter table public.appointments add column if not exists payment_status text not null default 'pending';
alter table public.appointments add column if not exists paid_amount numeric(12,2) not null default 0;
alter table public.appointments add column if not exists reminder_sent_at timestamptz;

-- Seed each account with useful defaults only when it has no services.
create or replace function public.seed_default_services(p_user uuid)
returns void language plpgsql security invoker as $$
begin
  if not exists (select 1 from public.services where user_id=p_user) then
    insert into public.services(user_id,name,price,duration_minutes) values
      (p_user,'Corte',60,60),(p_user,'Madeixas',180,180),(p_user,'Iluminado',130,150),
      (p_user,'Coloração completa',70,120),(p_user,'Avaliação para madeixas',30,30),
      (p_user,'Avaliação para extensões',15,30);
  end if;
end $$;