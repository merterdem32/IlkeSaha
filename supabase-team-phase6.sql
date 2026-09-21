-- İlke Saha - Faz 6
-- Bayi sorumlusu

alter table public.dealers
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_dealers_org_assigned_user
  on public.dealers(organization_id, assigned_user_id);

-- Mevcut İlke Akü bayilerinin tamamını saha1'e ata.
update public.dealers d
set assigned_user_id = p.user_id,
    updated_at = now()
from public.profiles p
where lower(p.username) = 'saha1'
  and d.organization_id is not null
  and d.assigned_user_id is null
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = d.organization_id
      and om.user_id = p.user_id
      and om.is_active = true
  );
