-- İlke Saha - Çok Kullanıcılı Ekip / Faz 2
-- Faz 1'den sonra çalıştırılır.
-- Mevcut owner politikalarını SİLMEZ; organizasyon erişimini ekler.

-- Ortak bayi kayıtları: organizasyon üyeleri okuyabilir ve düzenleyebilir.
drop policy if exists "dealers_org_read" on public.dealers;
create policy "dealers_org_read" on public.dealers
for select using (
  organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "dealers_org_insert" on public.dealers;
create policy "dealers_org_insert" on public.dealers
for insert with check (
  user_id = auth.uid()
  and organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "dealers_org_update" on public.dealers;
create policy "dealers_org_update" on public.dealers
for update using (
  organization_id is not null
  and public.is_org_member(organization_id)
)
with check (
  organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "dealers_manager_delete" on public.dealers;
create policy "dealers_manager_delete" on public.dealers
for delete using (
  organization_id is not null
  and public.is_org_manager(organization_id)
);

-- Ziyaretler
drop policy if exists "visits_org_read" on public.visits;
create policy "visits_org_read" on public.visits
for select using (
  organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "visits_org_insert" on public.visits;
create policy "visits_org_insert" on public.visits
for insert with check (
  user_id = auth.uid()
  and actor_user_id = auth.uid()
  and organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "visits_org_update" on public.visits;
create policy "visits_org_update" on public.visits
for update using (
  organization_id is not null
  and (actor_user_id = auth.uid() or public.is_org_manager(organization_id))
)
with check (
  organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "visits_org_delete" on public.visits;
create policy "visits_org_delete" on public.visits
for delete using (
  organization_id is not null
  and (actor_user_id = auth.uid() or public.is_org_manager(organization_id))
);

-- Ödeme sözleri
drop policy if exists "payments_org_read" on public.payment_promises;
create policy "payments_org_read" on public.payment_promises
for select using (
  organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "payments_org_insert" on public.payment_promises;
create policy "payments_org_insert" on public.payment_promises
for insert with check (
  user_id = auth.uid()
  and actor_user_id = auth.uid()
  and organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "payments_org_update" on public.payment_promises;
create policy "payments_org_update" on public.payment_promises
for update using (
  organization_id is not null
  and (actor_user_id = auth.uid() or public.is_org_manager(organization_id))
)
with check (
  organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "payments_org_delete" on public.payment_promises;
create policy "payments_org_delete" on public.payment_promises
for delete using (
  organization_id is not null
  and (actor_user_id = auth.uid() or public.is_org_manager(organization_id))
);

-- Toplantı notları organizasyon içinde ortak okunabilir/düzenlenebilir.
drop policy if exists "meeting_notes_org_read" on public.meeting_notes;
create policy "meeting_notes_org_read" on public.meeting_notes
for select using (
  organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "meeting_notes_org_insert" on public.meeting_notes;
create policy "meeting_notes_org_insert" on public.meeting_notes
for insert with check (
  user_id = auth.uid()
  and actor_user_id = auth.uid()
  and organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "meeting_notes_org_update" on public.meeting_notes;
create policy "meeting_notes_org_update" on public.meeting_notes
for update using (
  organization_id is not null
  and public.is_org_member(organization_id)
)
with check (
  organization_id is not null
  and public.is_org_member(organization_id)
);

drop policy if exists "meeting_notes_org_delete" on public.meeting_notes;
create policy "meeting_notes_org_delete" on public.meeting_notes
for delete using (
  organization_id is not null
  and (actor_user_id = auth.uid() or public.is_org_manager(organization_id))
);

-- Profil: ekip üyeleri birbirinin adını görebilsin.
drop policy if exists "profiles_org_read" on public.profiles;
create policy "profiles_org_read" on public.profiles
for select using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.is_active = true
      and theirs.user_id = profiles.user_id
      and theirs.is_active = true
  )
);

-- İlk MANAGER ataması Supabase SQL Editor'dan yapılabilir.
-- Sonrasında yöneticiler ekip üyelerinin rollerini bu RPC ile değiştirebilir.
create or replace function public.set_member_role(
  target_user uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
begin
  if new_role not in ('FIELD_STAFF','MANAGER') then
    raise exception 'Geçersiz rol';
  end if;

  select m.organization_id into target_org
  from public.organization_members m
  where m.user_id = target_user and m.is_active = true
  limit 1;

  if target_org is null then
    raise exception 'Kullanıcı aktif bir organizasyonda değil';
  end if;

  if not public.is_org_manager(target_org) then
    raise exception 'Bu işlem için MANAGER yetkisi gerekir';
  end if;

  update public.organization_members
  set role = new_role
  where organization_id = target_org
    and user_id = target_user;
end;
$$;
