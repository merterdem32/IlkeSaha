-- İlke Saha - Faz 8
-- Kişisel "Kendime Not" alanı. Notlar yalnızca sahibi tarafından görülebilir ve değiştirilebilir.

create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Not',
  note text not null default '',
  category text not null default 'GENEL'
    check (category in ('GENEL','IS','SISTEM','BAYI','FIKIR','YAPILACAK')),
  due_date date,
  status text not null default 'OPEN'
    check (status in ('OPEN','DONE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_personal_notes_user_status
  on public.personal_notes(user_id,status,updated_at desc);

create index if not exists idx_personal_notes_org_user
  on public.personal_notes(organization_id,user_id);

alter table public.personal_notes enable row level security;

drop policy if exists "personal_notes_own_read" on public.personal_notes;
create policy "personal_notes_own_read" on public.personal_notes
for select using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "personal_notes_own_insert" on public.personal_notes;
create policy "personal_notes_own_insert" on public.personal_notes
for insert with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "personal_notes_own_update" on public.personal_notes;
create policy "personal_notes_own_update" on public.personal_notes
for update using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
)
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "personal_notes_own_delete" on public.personal_notes;
create policy "personal_notes_own_delete" on public.personal_notes
for delete using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);
