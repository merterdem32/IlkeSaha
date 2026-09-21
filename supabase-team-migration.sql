-- İlke Saha - Çok Kullanıcılı Ekip Altyapısı / Güvenli Geçiş
-- Bu dosya mevcut saha verilerini SILMEZ.
-- İlk adımda mevcut tabloların anlık kopyalarını oluşturur.
-- Supabase > SQL Editor içinde bir kez çalıştırılabilir; tekrar çalıştırılması da güvenlidir.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0) GÜVENLİK YEDEĞİ
-- Bugünkü koordinatlar, ziyaretler, notlar, ödeme sözleri ve ayarlar korunur.
-- Bu tablolar ilk çalıştırmadaki durumu saklar; sonraki çalıştırmalarda değiştirilmez.
-- ---------------------------------------------------------------------------
create table if not exists public.legacy_backup_dealers_20260921
as select * from public.dealers;

create table if not exists public.legacy_backup_visits_20260921
as select * from public.visits;

create table if not exists public.legacy_backup_payment_promises_20260921
as select * from public.payment_promises;

create table if not exists public.legacy_backup_meeting_notes_20260921
as select * from public.meeting_notes;

create table if not exists public.legacy_backup_user_settings_20260921
as select * from public.user_settings;

-- ---------------------------------------------------------------------------
-- 1) ORGANİZASYON / PERSONEL / ROLLER
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'FIELD_STAFF'
    check (role in ('FIELD_STAFF','MANAGER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);

create index if not exists idx_org_members_user
  on public.organization_members(user_id);

-- ---------------------------------------------------------------------------
-- 2) AKTİVİTE / DENETİM KAYDI
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_org_created
  on public.activity_log(organization_id, created_at desc);

-- Uygulama tarafından alınabilecek ek JSON yedeği.
create table if not exists public.data_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  label text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3) MEVCUT VERİ TABLOLARINA ORGANİZASYON BİLGİSİ
-- Null bırakıyoruz: önceki veriler bu SQL çalışır çalışmaz bozulmaz.
-- Uygulamadaki güvenli taşıma işlemi sonradan org_id değerlerini dolduracak.
-- ---------------------------------------------------------------------------
alter table public.dealers
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.visits
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

alter table public.payment_promises
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

alter table public.meeting_notes
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

alter table public.user_settings
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists idx_dealers_org on public.dealers(organization_id);
create index if not exists idx_visits_org_date on public.visits(organization_id,visit_date desc);
create index if not exists idx_payments_org_date on public.payment_promises(organization_id,promise_date);
create index if not exists idx_meeting_notes_org on public.meeting_notes(organization_id);

-- ---------------------------------------------------------------------------
-- 4) RLS YARDIMCI FONKSİYONLARI
-- Security definer kullanılması organization_members üzerinde politika recursion'ını önler.
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.is_active = true
  );
$$;

create or replace function public.is_org_manager(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.is_active = true
      and m.role = 'MANAGER'
  );
$$;

-- ---------------------------------------------------------------------------
-- 5) RLS - YENİ TABLOLAR
-- Mevcut eski veri tablolarının owner policy'lerini bu aşamada KALDIRMIYORUZ.
-- Böylece mevcut uygulama geçiş tamamlanana kadar aynen çalışmaya devam eder.
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.activity_log enable row level security;
alter table public.data_backups enable row level security;

drop policy if exists "organizations_member_read" on public.organizations;
create policy "organizations_member_read" on public.organizations
for select using (public.is_org_member(id));

drop policy if exists "organizations_auth_insert" on public.organizations;
create policy "organizations_auth_insert" on public.organizations
for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
for select using (user_id = auth.uid());

drop policy if exists "profiles_self_write" on public.profiles;
create policy "profiles_self_write" on public.profiles
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "members_self_read" on public.organization_members;
create policy "members_self_read" on public.organization_members
for select using (
  user_id = auth.uid()
  or public.is_org_member(organization_id)
);

drop policy if exists "members_manager_update" on public.organization_members;
create policy "members_manager_update" on public.organization_members
for update using (public.is_org_manager(organization_id))
with check (public.is_org_manager(organization_id));

drop policy if exists "activity_member_read" on public.activity_log;
create policy "activity_member_read" on public.activity_log
for select using (public.is_org_member(organization_id));

drop policy if exists "activity_member_insert" on public.activity_log;
create policy "activity_member_insert" on public.activity_log
for insert with check (
  actor_user_id = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "backups_owner_all" on public.data_backups;
create policy "backups_owner_all" on public.data_backups
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6) BOOTSTRAP / EKİBE KATILMA RPC'LERİ
-- İlk kullanıcı kendi İlke Akü organizasyonunu güvenli biçimde oluşturabilir.
-- Sonraki personel join_code ile katılabilir.
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_organization(
  company_name text default 'İlke Akü',
  person_name text default null
)
returns table(organization_id uuid, join_code text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_org uuid;
  new_org uuid;
  code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select m.organization_id into existing_org
  from public.organization_members m
  where m.user_id = auth.uid() and m.is_active = true
  limit 1;

  if existing_org is not null then
    return query
    select o.id, o.join_code, m.role
    from public.organizations o
    join public.organization_members m on m.organization_id=o.id
    where o.id=existing_org and m.user_id=auth.uid();
    return;
  end if;

  insert into public.organizations(name,created_by)
  values (coalesce(nullif(trim(company_name),''),'İlke Akü'),auth.uid())
  returning id, organizations.join_code into new_org,code;

  insert into public.organization_members(organization_id,user_id,role)
  values(new_org,auth.uid(),'FIELD_STAFF');

  insert into public.profiles(user_id,full_name,email)
  values(auth.uid(),person_name,auth.jwt()->>'email')
  on conflict(user_id) do update
    set full_name=coalesce(excluded.full_name,profiles.full_name),
        email=coalesce(excluded.email,profiles.email),
        updated_at=now();

  return query select new_org,code,'FIELD_STAFF'::text;
end;
$$;

create or replace function public.join_organization(
  invite_code text,
  person_name text default null
)
returns table(organization_id uuid, organization_name text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
  target_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id,o.name into target_org,target_name
  from public.organizations o
  where upper(o.join_code)=upper(trim(invite_code))
  limit 1;

  if target_org is null then
    raise exception 'Geçersiz ekip kodu';
  end if;

  insert into public.organization_members(organization_id,user_id,role,is_active)
  values(target_org,auth.uid(),'FIELD_STAFF',true)
  on conflict(organization_id,user_id)
  do update set is_active=true;

  insert into public.profiles(user_id,full_name,email)
  values(auth.uid(),person_name,auth.jwt()->>'email')
  on conflict(user_id) do update
    set full_name=coalesce(excluded.full_name,profiles.full_name),
        email=coalesce(excluded.email,profiles.email),
        updated_at=now();

  return query select target_org,target_name,'FIELD_STAFF'::text;
end;
$$;

-- Bu aşama sonrasında mevcut saha uygulaması çalışmaya devam eder.
-- Sonraki frontend sürümü, önce JSON yedeği alıp mevcut kayıtları organization_id ile eşleştirecek.
