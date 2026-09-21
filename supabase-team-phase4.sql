-- İlke Saha - Faz 4
-- Personel + tarih bazlı gerçek rut yönetimi.

create table if not exists public.daily_routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_user_id uuid not null references auth.users(id) on delete cascade,
  route_date date not null,
  status text not null default 'PLANNED'
    check (status in ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, assigned_user_id, route_date)
);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.daily_routes(id) on delete cascade,
  dealer_id text not null,
  stop_order integer not null,
  created_at timestamptz not null default now(),
  unique (route_id, dealer_id),
  unique (route_id, stop_order)
);

create index if not exists idx_daily_routes_org_date
  on public.daily_routes(organization_id,route_date);

create index if not exists idx_daily_routes_user_date
  on public.daily_routes(assigned_user_id,route_date);

create index if not exists idx_route_stops_route_order
  on public.route_stops(route_id,stop_order);

alter table public.daily_routes enable row level security;
alter table public.route_stops enable row level security;

drop policy if exists "daily_routes_member_read" on public.daily_routes;
create policy "daily_routes_member_read" on public.daily_routes
for select using (
  public.is_org_member(organization_id)
);

drop policy if exists "daily_routes_insert" on public.daily_routes;
create policy "daily_routes_insert" on public.daily_routes
for insert with check (
  public.is_org_member(organization_id)
  and (
    assigned_user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
);

drop policy if exists "daily_routes_update" on public.daily_routes;
create policy "daily_routes_update" on public.daily_routes
for update using (
  assigned_user_id = auth.uid()
  or public.is_org_manager(organization_id)
)
with check (
  public.is_org_member(organization_id)
  and (
    assigned_user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
);

drop policy if exists "daily_routes_delete" on public.daily_routes;
create policy "daily_routes_delete" on public.daily_routes
for delete using (
  assigned_user_id = auth.uid()
  or public.is_org_manager(organization_id)
);

drop policy if exists "route_stops_member_read" on public.route_stops;
create policy "route_stops_member_read" on public.route_stops
for select using (
  exists (
    select 1 from public.daily_routes r
    where r.id = route_stops.route_id
      and public.is_org_member(r.organization_id)
  )
);

drop policy if exists "route_stops_insert" on public.route_stops;
create policy "route_stops_insert" on public.route_stops
for insert with check (
  exists (
    select 1 from public.daily_routes r
    where r.id = route_stops.route_id
      and (
        r.assigned_user_id = auth.uid()
        or public.is_org_manager(r.organization_id)
      )
  )
);

drop policy if exists "route_stops_update" on public.route_stops;
create policy "route_stops_update" on public.route_stops
for update using (
  exists (
    select 1 from public.daily_routes r
    where r.id = route_stops.route_id
      and (
        r.assigned_user_id = auth.uid()
        or public.is_org_manager(r.organization_id)
      )
  )
)
with check (
  exists (
    select 1 from public.daily_routes r
    where r.id = route_stops.route_id
      and (
        r.assigned_user_id = auth.uid()
        or public.is_org_manager(r.organization_id)
      )
  )
);

drop policy if exists "route_stops_delete" on public.route_stops;
create policy "route_stops_delete" on public.route_stops
for delete using (
  exists (
    select 1 from public.daily_routes r
    where r.id = route_stops.route_id
      and (
        r.assigned_user_id = auth.uid()
        or public.is_org_manager(r.organization_id)
      )
  )
);
