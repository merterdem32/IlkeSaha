-- İlke Saha - Faz 3
-- Kullanıcı adı tabanlı giriş ve yönetici tarafından hesap oluşturma altyapısı.

alter table public.profiles
  add column if not exists username text,
  add column if not exists role_label text;

create unique index if not exists idx_profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

-- Kullanıcı adından sentetik giriş e-postası üretmek için yardımcı fonksiyon.
-- Örn: saha1 -> saha1@login.ilkesaha.local
create or replace function public.login_email_for_username(login_name text)
returns text
language sql
immutable
as $$
  select lower(trim(login_name)) || '@login.ilkesaha.local';
$$;

-- Yöneticinin ekip kullanıcılarını listeleyebilmesi için görünüm.
create or replace view public.team_directory as
select
  m.organization_id,
  m.user_id,
  m.role,
  m.is_active,
  p.username,
  p.full_name,
  p.email,
  m.created_at
from public.organization_members m
left join public.profiles p on p.user_id = m.user_id;

grant select on public.team_directory to authenticated;

-- İlk yönetici oluşturulmadan önce organizasyonu oluşturan kullanıcı da
-- kullanıcı oluşturma Edge Function'ını çağırabilecek.
create or replace function public.can_manage_users(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = target_org
      and (
        o.created_by = auth.uid()
        or public.is_org_manager(target_org)
      )
  );
$$;
