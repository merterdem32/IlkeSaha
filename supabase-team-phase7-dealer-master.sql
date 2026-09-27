-- İlke Saha - Faz 7A
-- Organizasyon seviyesinde tekil bayi ana tablosu (güvenli hazırlık aşaması)
--
-- ÖNEMLİ:
-- 1) Bu script mevcut public.dealers tablosunu SILMEZ veya yeniden adlandırmaz.
-- 2) İlk iş olarak 27.09.2026 tarihli yeni bir tam bayi yedeği oluşturur.
-- 3) Yeni public.organization_dealers tablosunu oluşturur ve mevcut veriyi kopyalar.
-- 4) Aynı organization_id + dealer id için birden fazla eski satır varsa en güncel satırı alır.
-- 5) Eski uygulama bu aşamada public.dealers kullanmaya devam edebilir.
--    Frontend geçişi ayrı adımda yapılacaktır.
--
-- Bu nedenle bu script çalıştırıldıktan sonra geri dönüş için hem eski tablo
-- hem de sabit snapshot elde kalır.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0) YENİ, DEĞİŞMEZ YEDEK
-- 21.09 yedeğinden sonra saha2 koordinatları girildiği için bugünkü anlık
-- görüntüyü ayrıca saklıyoruz.
-- ---------------------------------------------------------------------------
create table if not exists public.legacy_backup_dealers_pre_orgmaster_20260927
as select * from public.dealers;

-- Yedeğin yanlışlıkla uygulama tarafından değiştirilmesini önlemek için
-- normal authenticated erişimi vermiyoruz. SQL Editor / servis rolü görebilir.

-- ---------------------------------------------------------------------------
-- 1) ORGANİZASYON SEVİYESİNDE TEK BAYİ ANA TABLOSU
-- Eski PK (user_id,id) yerine yeni PK (organization_id,id).
-- ---------------------------------------------------------------------------
create table if not exists public.organization_dealers (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  id text not null,
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
  assigned_user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id,id)
);

create index if not exists idx_org_dealers_assigned
  on public.organization_dealers(organization_id,assigned_user_id);

create index if not exists idx_org_dealers_name
  on public.organization_dealers(organization_id,name);

-- ---------------------------------------------------------------------------
-- 2) MEVCUT VERİYİ KOPYALA
-- Aynı bayi eski tabloda birden fazla user_id altında bulunabiliyorsa,
-- en son güncellenmiş sürümü seçiyoruz. Koordinat güncellemeleri updated_at
-- değerini de güncellediği için son saha kaydı korunur.
-- organization_id NULL olan eski/bağsız satırları bu aşamada taşımıyoruz;
-- onlar eski tabloda ve snapshot'ta aynen kalır.
-- ---------------------------------------------------------------------------
with ranked as (
  select
    d.*,
    row_number() over (
      partition by d.organization_id,d.id
      order by d.updated_at desc nulls last,
               (d.lat is not null and d.lng is not null) desc,
               d.user_id::text
    ) as rn
  from public.dealers d
  where d.organization_id is not null
),
latest as (
  select * from ranked where rn=1
)
insert into public.organization_dealers (
  organization_id,id,name,contact,phone,district,address,lat,lng,
  location_status,frequency,priority,general_note,
  planned_week,planned_day,planned_order,planned_stage,original_route_logic,
  departure,assigned_user_id,is_active,created_by,updated_by,updated_at
)
select
  organization_id,id,name,contact,phone,district,address,lat,lng,
  location_status,frequency,priority,general_note,
  planned_week,planned_day,planned_order,planned_stage,original_route_logic,
  departure,assigned_user_id,is_active,
  coalesce(created_by,user_id),
  coalesce(updated_by,user_id),
  coalesce(updated_at,now())
from latest
on conflict (organization_id,id) do update set
  name=excluded.name,
  contact=excluded.contact,
  phone=excluded.phone,
  district=excluded.district,
  address=excluded.address,
  lat=excluded.lat,
  lng=excluded.lng,
  location_status=excluded.location_status,
  frequency=excluded.frequency,
  priority=excluded.priority,
  general_note=excluded.general_note,
  planned_week=excluded.planned_week,
  planned_day=excluded.planned_day,
  planned_order=excluded.planned_order,
  planned_stage=excluded.planned_stage,
  original_route_logic=excluded.original_route_logic,
  departure=excluded.departure,
  assigned_user_id=excluded.assigned_user_id,
  is_active=excluded.is_active,
  created_by=coalesce(public.organization_dealers.created_by,excluded.created_by),
  updated_by=excluded.updated_by,
  updated_at=excluded.updated_at;

-- ---------------------------------------------------------------------------
-- 3) RLS
-- Saha personeli yalnızca kendisine atanmış bayiyi günceller.
-- Yönetici tüm organizasyon bayilerini yönetebilir.
-- Organizasyon üyeleri kendi organizasyonunun bayi listesini okuyabilir.
-- ---------------------------------------------------------------------------
alter table public.organization_dealers enable row level security;

drop policy if exists "org_dealers_member_read" on public.organization_dealers;
create policy "org_dealers_member_read" on public.organization_dealers
for select using (
  public.is_org_member(organization_id)
);

drop policy if exists "org_dealers_insert" on public.organization_dealers;
create policy "org_dealers_insert" on public.organization_dealers
for insert with check (
  public.is_org_member(organization_id)
  and (
    assigned_user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
);

drop policy if exists "org_dealers_update" on public.organization_dealers;
create policy "org_dealers_update" on public.organization_dealers
for update using (
  public.is_org_member(organization_id)
  and (
    assigned_user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
)
with check (
  public.is_org_member(organization_id)
  and (
    assigned_user_id = auth.uid()
    or public.is_org_manager(organization_id)
  )
);

drop policy if exists "org_dealers_manager_delete" on public.organization_dealers;
create policy "org_dealers_manager_delete" on public.organization_dealers
for delete using (
  public.is_org_manager(organization_id)
);

grant select,insert,update,delete on public.organization_dealers to authenticated;

-- ---------------------------------------------------------------------------
-- 4) DOĞRULAMA RAPORU
-- SQL Editor bu satırların sonucunu gösterecek.
-- duplicate_old_rows > 0 olması tek başına hata değildir; eski mimarinin
-- aynı bayi id'sini farklı user_id altında tutabildiğini gösterir.
-- copied_unique_dealers, old_unique_org_dealers ile eşit olmalıdır.
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.dealers) as old_total_rows,
  (select count(*) from public.legacy_backup_dealers_pre_orgmaster_20260927) as backup_total_rows,
  (select count(*) from public.dealers where organization_id is not null) as old_org_rows,
  (select count(*) from (
     select organization_id,id
     from public.dealers
     where organization_id is not null
     group by organization_id,id
   ) x) as old_unique_org_dealers,
  (select count(*) from public.organization_dealers) as copied_unique_dealers,
  (select count(*) from public.dealers where organization_id is null) as legacy_unattached_rows,
  (
    select coalesce(sum(cnt-1),0)
    from (
      select count(*) cnt
      from public.dealers
      where organization_id is not null
      group by organization_id,id
      having count(*)>1
    ) d
  ) as duplicate_old_rows,
  (select count(*) from public.organization_dealers where lat is not null and lng is not null) as copied_with_coordinates;
