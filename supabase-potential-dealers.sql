-- İlke Saha - Potansiyel Bayiler / Rota Dışı Ziyaretler
-- Saha personelinin henüz bayi kartı olmayan firmaları ve bu firmalara yaptığı ziyaretleri takip eder.

create table if not exists public.potential_dealers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact text,
  phone text,
  district text,
  address text,
  lat double precision,
  lng double precision,
  status text not null default 'POTENTIAL'
    check (status in ('POTENTIAL','CONVERTED','ARCHIVED')),
  converted_dealer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.potential_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  potential_dealer_id uuid not null references public.potential_dealers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  visit_date timestamptz not null default now(),
  note text,
  follow_up date,
  created_at timestamptz not null default now()
);

create index if not exists idx_potential_dealers_org_status
  on public.potential_dealers(organization_id,status);

create index if not exists idx_potential_dealers_assigned
  on public.potential_dealers(assigned_user_id,status);

create index if not exists idx_potential_visits_dealer_date
  on public.potential_visits(potential_dealer_id,visit_date desc);

alter table public.potential_dealers enable row level security;
alter table public.potential_visits enable row level security;

drop policy if exists "potential_dealers_member_read" on public.potential_dealers;
create policy "potential_dealers_member_read" on public.potential_dealers
for select using (
  public.is_org_member(organization_id)
);

drop policy if exists "potential_dealers_insert" on public.potential_dealers;
create policy "potential_dealers_insert" on public.potential_dealers
for insert with check (
  public.is_org_member(organization_id)
  and owner_user_id = auth.uid()
  and (
    assigned_user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
);

drop policy if exists "potential_dealers_update" on public.potential_dealers;
create policy "potential_dealers_update" on public.potential_dealers
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

drop policy if exists "potential_dealers_delete" on public.potential_dealers;
create policy "potential_dealers_delete" on public.potential_dealers
for delete using (
  owner_user_id = auth.uid()
  or public.is_org_manager(organization_id)
);

drop policy if exists "potential_visits_member_read" on public.potential_visits;
create policy "potential_visits_member_read" on public.potential_visits
for select using (
  public.is_org_member(organization_id)
);

drop policy if exists "potential_visits_insert" on public.potential_visits;
create policy "potential_visits_insert" on public.potential_visits
for insert with check (
  public.is_org_member(organization_id)
  and actor_user_id = auth.uid()
  and exists (
    select 1
    from public.potential_dealers p
    where p.id = potential_visits.potential_dealer_id
      and p.organization_id = potential_visits.organization_id
      and (
        p.assigned_user_id = auth.uid()
        or public.is_org_manager(p.organization_id)
      )
  )
);

drop policy if exists "potential_visits_update" on public.potential_visits;
create policy "potential_visits_update" on public.potential_visits
for update using (
  actor_user_id = auth.uid()
  or public.is_org_manager(organization_id)
)
with check (
  public.is_org_member(organization_id)
);

drop policy if exists "potential_visits_delete" on public.potential_visits;
create policy "potential_visits_delete" on public.potential_visits
for delete using (
  actor_user_id = auth.uid()
  or public.is_org_manager(organization_id)
);
