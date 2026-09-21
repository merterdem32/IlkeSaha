-- İlke Saha - Faz 5
-- 2 haftalık sabit rut şablonları + günlük rutun otomatik üretilmesi

create table if not exists public.recurring_routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_user_id uuid not null references auth.users(id) on delete cascade,
  cycle_week integer not null check (cycle_week in (1,2)),
  weekday integer not null check (weekday between 1 and 6), -- 1=Pzt ... 6=Cmt
  title text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,assigned_user_id,cycle_week,weekday)
);

create table if not exists public.recurring_route_stops (
  id uuid primary key default gen_random_uuid(),
  recurring_route_id uuid not null references public.recurring_routes(id) on delete cascade,
  dealer_id text not null,
  stop_order integer not null,
  created_at timestamptz not null default now(),
  unique (recurring_route_id,dealer_id),
  unique (recurring_route_id,stop_order)
);

create index if not exists idx_recurring_routes_user
  on public.recurring_routes(organization_id,assigned_user_id,cycle_week,weekday);

create index if not exists idx_recurring_stops_order
  on public.recurring_route_stops(recurring_route_id,stop_order);

alter table public.recurring_routes enable row level security;
alter table public.recurring_route_stops enable row level security;

drop policy if exists "recurring_routes_member_read" on public.recurring_routes;
create policy "recurring_routes_member_read" on public.recurring_routes
for select using (public.is_org_member(organization_id));

drop policy if exists "recurring_routes_owner_manager_write" on public.recurring_routes;
create policy "recurring_routes_owner_manager_write" on public.recurring_routes
for all using (
  assigned_user_id=auth.uid() or public.is_org_manager(organization_id)
)
with check (
  public.is_org_member(organization_id)
  and (assigned_user_id=auth.uid() or public.is_org_manager(organization_id))
);

drop policy if exists "recurring_stops_member_read" on public.recurring_route_stops;
create policy "recurring_stops_member_read" on public.recurring_route_stops
for select using (
  exists (
    select 1 from public.recurring_routes r
    where r.id=recurring_route_stops.recurring_route_id
      and public.is_org_member(r.organization_id)
  )
);

drop policy if exists "recurring_stops_owner_manager_write" on public.recurring_route_stops;
create policy "recurring_stops_owner_manager_write" on public.recurring_route_stops
for all using (
  exists (
    select 1 from public.recurring_routes r
    where r.id=recurring_route_stops.recurring_route_id
      and (r.assigned_user_id=auth.uid() or public.is_org_manager(r.organization_id))
  )
)
with check (
  exists (
    select 1 from public.recurring_routes r
    where r.id=recurring_route_stops.recurring_route_id
      and (r.assigned_user_id=auth.uid() or public.is_org_manager(r.organization_id))
  )
);
