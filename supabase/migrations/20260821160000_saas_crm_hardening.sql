-- Extensão do CRM/agenda. Tudo fica no mesmo projeto Supabase e é isolado por user_id.
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0 check (price >= 0),
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists services_user_idx on public.services(user_id, active);

create table if not exists public.collaborators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists collaborators_user_idx on public.collaborators(user_id, active);

alter table public.appointments add column if not exists service_id uuid references public.services(id) on delete set null;
alter table public.appointments add column if not exists service_price numeric(12,2);
alter table public.appointments add column if not exists collaborator_id uuid references public.collaborators(id) on delete set null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_appointments boolean not null default true,
  email_reminders boolean not null default true,
  reminder_hours integer not null default 24 check (reminder_hours between 1 and 168),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);

alter table public.services enable row level security;
alter table public.collaborators enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists services_owner_all on public.services;
create policy services_owner_all on public.services for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists collaborators_owner_all on public.collaborators;
create policy collaborators_owner_all on public.collaborators for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists notification_preferences_owner_all on public.notification_preferences;
create policy notification_preferences_owner_all on public.notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists audit_logs_owner_select on public.audit_logs;
create policy audit_logs_owner_select on public.audit_logs for select using (auth.uid() = user_id);

-- Audit logs are intended to be written server-side only.
revoke insert, update, delete on public.audit_logs from anon, authenticated;
