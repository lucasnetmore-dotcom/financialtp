create table if not exists public.ceo_owner_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minimum_cash numeric not null default 10000,
  minimum_margin numeric not null default 25,
  hiring_occupancy numeric not null default 80,
  current_priority text not null default 'Crescer com margem e preservar caixa',
  updated_at timestamptz not null default now()
);

alter table public.ceo_owner_memory enable row level security;

grant select, insert, update, delete on public.ceo_owner_memory to authenticated;

create policy "ceo_owner_memory_select_own" on public.ceo_owner_memory for select to authenticated using ((select auth.uid()) = user_id);
create policy "ceo_owner_memory_insert_own" on public.ceo_owner_memory for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ceo_owner_memory_update_own" on public.ceo_owner_memory for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ceo_owner_memory_delete_own" on public.ceo_owner_memory for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.ceo_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  title text not null,
  status text not null default 'prepared' check (status in ('prepared','approved','contacted','responded','booked','completed','cancelled')),
  target_count integer not null default 0,
  contacted_count integer not null default 0,
  responded_count integer not null default 0,
  booked_count integer not null default 0,
  recovered_revenue numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ceo_actions enable row level security;
grant select, insert, update, delete on public.ceo_actions to authenticated;

create policy "ceo_actions_select_own" on public.ceo_actions for select to authenticated using ((select auth.uid()) = user_id);
create policy "ceo_actions_insert_own" on public.ceo_actions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ceo_actions_update_own" on public.ceo_actions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ceo_actions_delete_own" on public.ceo_actions for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists ceo_actions_user_created_idx on public.ceo_actions(user_id, created_at desc);
