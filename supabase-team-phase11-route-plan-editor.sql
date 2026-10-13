-- İlke Saha - Faz 11
-- Rut Planı / Rut Planı2 kaynak planlarını kullanıcı + hafta + gün bazında düzenlenebilir yapar.
-- Mevcut bayi/rut verilerine dokunmaz; yalnızca gün bazlı sıralı bayi listelerini saklayan yeni tablo ekler.

create table if not exists public.route_plan_templates (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_type text not null check (plan_type in ('ROUTE1','ROUTE2')),
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  week_no smallint not null check (week_no in (1,2)),
  day_name text not null,
  dealer_ids text[] not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id,plan_type,staff_user_id,week_no,day_name)
);

create index if not exists idx_route_plan_templates_staff
  on public.route_plan_templates(organization_id,staff_user_id,plan_type);

alter table public.route_plan_templates enable row level security;

drop policy if exists "route_plan_templates_read" on public.route_plan_templates;
create policy "route_plan_templates_read" on public.route_plan_templates
for select using (
  public.is_org_member(organization_id)
);

drop policy if exists "route_plan_templates_insert" on public.route_plan_templates;
create policy "route_plan_templates_insert" on public.route_plan_templates
for insert with check (
  public.is_org_member(organization_id)
  and (
    public.is_org_manager(organization_id)
    or staff_user_id = auth.uid()
  )
);

drop policy if exists "route_plan_templates_update" on public.route_plan_templates;
create policy "route_plan_templates_update" on public.route_plan_templates
for update using (
  public.is_org_member(organization_id)
  and (
    public.is_org_manager(organization_id)
    or staff_user_id = auth.uid()
  )
)
with check (
  public.is_org_member(organization_id)
  and (
    public.is_org_manager(organization_id)
    or staff_user_id = auth.uid()
  )
);

drop policy if exists "route_plan_templates_delete" on public.route_plan_templates;
create policy "route_plan_templates_delete" on public.route_plan_templates
for delete using (
  public.is_org_member(organization_id)
  and (
    public.is_org_manager(organization_id)
    or staff_user_id = auth.uid()
  )
);

grant select,insert,update,delete on public.route_plan_templates to authenticated;
