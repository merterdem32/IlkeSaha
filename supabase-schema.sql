-- İlke Saha cloud schema
-- Run this once in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.dealers (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact text,
  phone text,
  district text,
  address text,
  lat double precision,
  lng double precision,
  location_status text not null default 'unset',
  frequency integer not null default 14,
  priority integer not null default 1,
  general_note text,
  planned_week text,
  planned_day text,
  planned_order integer,
  planned_stage text,
  original_route_logic text,
  departure text,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.visits (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  dealer_id text not null,
  visit_date timestamptz not null,
  note text,
  follow_up date,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.payment_promises (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  dealer_id text not null,
  amount numeric(14,2) not null default 0,
  promise_date date not null,
  note text,
  status text not null default 'pending',
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_lat double precision,
  home_lng double precision,
  start_time time not null default '08:30',
  end_time time not null default '18:30',
  visit_minutes integer not null default 20,
  max_stops integer not null default 12,
  prioritize_payments boolean not null default true,
  prefer_home_finish boolean not null default true,
  today_route jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dealers enable row level security;
alter table public.visits enable row level security;
alter table public.payment_promises enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "dealers_owner_all" on public.dealers;
create policy "dealers_owner_all" on public.dealers
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "visits_owner_all" on public.visits;
create policy "visits_owner_all" on public.visits
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "payments_owner_all" on public.payment_promises;
create policy "payments_owner_all" on public.payment_promises
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "settings_owner_all" on public.user_settings;
create policy "settings_owner_all" on public.user_settings
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


create table if not exists public.meeting_notes (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  note text not null,
  meeting_date date,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.meeting_notes enable row level security;

drop policy if exists "meeting_notes_owner_all" on public.meeting_notes;
create policy "meeting_notes_owner_all" on public.meeting_notes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
