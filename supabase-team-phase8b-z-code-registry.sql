-- İlke Saha - Faz 8B
-- Z Kodlu bayi havuzu + güvenli ekle/çıkar işlemleri
-- Faz 8'den sonra çalıştırılır.

create table if not exists public.z_code_registry (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cari_code text not null,
  display_name text not null,
  dealer_id text,
  source text not null default 'MANUAL',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id,cari_code)
);

create index if not exists idx_z_code_registry_org_active
  on public.z_code_registry(organization_id,is_active);

create index if not exists idx_z_code_registry_dealer
  on public.z_code_registry(organization_id,dealer_id)
  where dealer_id is not null;

alter table public.z_code_registry enable row level security;

drop policy if exists "z_registry_member_read" on public.z_code_registry;
create policy "z_registry_member_read" on public.z_code_registry
for select using (public.is_org_member(organization_id));

drop policy if exists "z_registry_member_insert" on public.z_code_registry;
create policy "z_registry_member_insert" on public.z_code_registry
for insert with check (
  public.is_org_member(organization_id)
  and created_by = auth.uid()
);

drop policy if exists "z_registry_member_update" on public.z_code_registry;
create policy "z_registry_member_update" on public.z_code_registry
for update using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

grant select,insert,update on public.z_code_registry to authenticated;

-- Fotoğraf + Trakya Excel başlangıç havuzu.
with z_seed(cari_code,display_name,match_text,source) as (
  values
    ('120.01.0448','FARUK ETE - GARAJ 13','FARUK ETE','FOTOĞRAF'),
    ('120.01.0434','OKAN BAYSAL - FERA AKÜ MARKET','OKAN BAYSAL','FOTOĞRAF'),
    ('120.01.0406','ONUR ALANLAR','ONUR ALANLAR','FOTOĞRAF'),
    ('120.01.0399','YASİN KARATAŞ - GÖRKEM OTO','GÖRKEM OTO','FOTOĞRAF'),
    ('120.01.0337','GÖKSUN ÖZTÜRK - HYK HAFRİYAT','GÖKSUN ÖZTÜRK','FOTOĞRAF'),
    ('120.01.0326','GURUR GÜRBÜZ','GURUR GÜRBÜZ','FOTOĞRAF'),
    ('120.01.0237','NURCİHAN CEYLAN - CEYKAR OTOMOTİV','NURCİHAN CEYLAN','FOTOĞRAF'),
    ('120.01.0200','AHMET KARA - PINARBAŞI OTO ELEKTRİK','AHMET KARA-PINARBAŞI','FOTOĞRAF'),
    ('120.01.0118','LİDER NEVA OTOMOTİV İÇ VE DIŞ TİC. LTD. ŞTİ.','LİDER NEVA','FOTOĞRAF'),
    ('120.01.0055','KADİR TOPÇI - SAĞLAM TRUCK','SAĞLAM TRUCK','FOTOĞRAF'),
    ('120.01.0036','ALİ KESKİN - KESKİNLER OTOMOTİV','ALİ KESKİN','FOTOĞRAF'),

    ('120.01.0270','RECEP KÜÇÜK','RECEP KÜÇÜK','TRAKYA EXCEL'),
    ('120.01.0230','YIL OTO YEDEK PARÇA','YIL OTO YEDEK PARÇA','TRAKYA EXCEL'),
    ('120.01.0341','MUSTAFA HIZIR','MUSTAFA HIZIR','TRAKYA EXCEL'),
    ('120.01.0339','CEM METİN','CEM METİN','TRAKYA EXCEL'),
    ('120.01.0263','SAZLIDERELİ OTOMOTİV','SAZLIDERELİ OTOMOTİV','TRAKYA EXCEL'),
    ('120.01.0250','CEMALETTİN TANIR','CEMALETTİN TANIR','TRAKYA EXCEL'),
    ('120.01.0107','HASAN İŞGÖRÜR','HASAN İŞGÖRÜR','TRAKYA EXCEL'),
    ('120.01.0423','HALİL ALPARSLAN','HALİL ALPARSLAN','TRAKYA EXCEL'),
    ('120.01.0401','OSMAN MUMCU','OSMAN MUMCU','TRAKYA EXCEL'),
    ('120.01.0340','İSMAİL KARAGÖZ','İSMAİL KARAGÖZ','TRAKYA EXCEL'),
    ('120.01.0281','SERKAN PEKER','SERKAN PEKER','TRAKYA EXCEL'),
    ('120.01.0260','MUZAFFER ÖZTEN','MUZAFFER ÖZTEN','TRAKYA EXCEL'),
    ('120.01.0167','SEDA BİRİNCİ','SEDA BİRİNCİ','TRAKYA EXCEL'),
    ('120.01.0115','ÖZKAN KANA','ÖZKAN KANA','TRAKYA EXCEL'),
    ('120.01.0480','BÜLENT BURMACI','BÜLENT BURMACI','TRAKYA EXCEL'),
    ('120.01.0279','HÜSNÜ KALYONCU','HÜSNÜ KALYONCU','TRAKYA EXCEL'),
    ('120.01.0278','İBRAHİM ÇİZEN','İBRAHİM ÇİZEN','TRAKYA EXCEL'),
    ('120.01.0256','VEMER OTOMOTİV','VEMER OTOMOTİV','TRAKYA EXCEL'),
    ('120.01.0252','FATMA ATA','FATMA ATA','TRAKYA EXCEL'),
    ('120.01.0243','CEYHUN AVŞAR','CEYHUN AVŞAR','TRAKYA EXCEL'),
    ('120.01.0226','ZEYNEL VE MUSTAFA SARSILMAZ','ZEYNEL VE MUSTAFA SARSILMAZ','TRAKYA EXCEL'),
    ('120.01.0194','ERGÜL TERZİ','ERGÜL TERZİ','TRAKYA EXCEL'),
    ('120.01.0166','SAMİ ÖZER','SAMİ ÖZER','TRAKYA EXCEL'),
    ('120.01.0128','MAHMUT KAYDI','MAHMUT KAYDI','TRAKYA EXCEL'),
    ('120.01.0127','YAHYA ACAR','YAHYA ACAR','TRAKYA EXCEL'),
    ('120.01.0045','DENGE HASAR','DENGE HASAR','TRAKYA EXCEL'),
    ('120.01.0020','ÖZ OTO - EKREM ÖZYOLCU','ÖZ OTO-EKREM ÖZYOLCU','TRAKYA EXCEL')
),
org_seed as (
  select
    o.id as organization_id,
    z.cari_code,
    z.display_name,
    z.source,
    (
      select d.id
      from public.organization_dealers d
      where d.organization_id=o.id
        and upper(d.name) like '%' || upper(z.match_text) || '%'
      order by d.updated_at desc
      limit 1
    ) as dealer_id
  from public.organizations o
  cross join z_seed z
)
insert into public.z_code_registry(
  organization_id,cari_code,display_name,dealer_id,source,is_active
)
select organization_id,cari_code,display_name,dealer_id,source,true
from org_seed
on conflict (organization_id,cari_code) do update set
  display_name=excluded.display_name,
  dealer_id=coalesce(public.z_code_registry.dealer_id,excluded.dealer_id),
  source=excluded.source,
  is_active=true,
  updated_at=now();

-- Registry'de bağlı olan bayileri de kesin olarak Z kodlu işaretle.
update public.organization_dealers d
set is_z_code=true,
    cari_code=coalesce(d.cari_code,z.cari_code),
    updated_at=now()
from public.z_code_registry z
where z.organization_id=d.organization_id
  and z.dealer_id=d.id
  and z.is_active=true;

-- Mevcut bir bayiyi Z kodlu yap / Z kodundan çıkar.
create or replace function public.set_dealer_z_code(
  target_org uuid,
  target_dealer_id text,
  target_is_z boolean,
  target_cari_code text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  dname text;
  effective_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_org_member(target_org) then
    raise exception 'Bu organizasyona erişim yok';
  end if;

  select name,coalesce(nullif(trim(target_cari_code),''),cari_code)
    into dname,effective_code
  from public.organization_dealers
  where organization_id=target_org and id=target_dealer_id;

  if dname is null then
    raise exception 'Bayi bulunamadı';
  end if;

  update public.organization_dealers
  set is_z_code=target_is_z,
      cari_code=case
        when target_is_z then coalesce(effective_code,cari_code)
        else cari_code
      end,
      updated_by=auth.uid(),
      updated_at=now()
  where organization_id=target_org and id=target_dealer_id;

  if target_is_z then
    if effective_code is null then
      effective_code='MANUAL-' || target_dealer_id;
    end if;

    insert into public.z_code_registry(
      organization_id,cari_code,display_name,dealer_id,source,is_active,created_by,updated_by
    )
    values(target_org,effective_code,dname,target_dealer_id,'MANUAL',true,auth.uid(),auth.uid())
    on conflict (organization_id,cari_code) do update set
      display_name=excluded.display_name,
      dealer_id=excluded.dealer_id,
      is_active=true,
      updated_by=auth.uid(),
      updated_at=now();
  else
    update public.z_code_registry
    set is_active=false,updated_by=auth.uid(),updated_at=now()
    where organization_id=target_org and dealer_id=target_dealer_id;
  end if;
end;
$$;

grant execute on function public.set_dealer_z_code(uuid,text,boolean,text) to authenticated;

-- Bağımsız (henüz Bayiler listesinde bulunmayan) Z kodlu müşteri eklemek için RPC.
create or replace function public.upsert_z_code_registry(
  target_org uuid,
  target_cari_code text,
  target_display_name text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(target_org) then raise exception 'Bu organizasyona erişim yok'; end if;
  if nullif(trim(target_cari_code),'') is null or nullif(trim(target_display_name),'') is null then
    raise exception 'Cari kod ve ünvan gerekli';
  end if;

  insert into public.z_code_registry(
    organization_id,cari_code,display_name,source,is_active,created_by,updated_by
  )
  values(target_org,trim(target_cari_code),trim(target_display_name),'MANUAL',true,auth.uid(),auth.uid())
  on conflict (organization_id,cari_code) do update set
    display_name=excluded.display_name,
    is_active=true,
    updated_by=auth.uid(),
    updated_at=now();
end;
$$;

grant execute on function public.upsert_z_code_registry(uuid,text,text) to authenticated;

create or replace function public.remove_z_code_registry(
  target_org uuid,
  target_cari_code text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  linked_dealer text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_org_member(target_org) then raise exception 'Bu organizasyona erişim yok'; end if;

  select dealer_id into linked_dealer
  from public.z_code_registry
  where organization_id=target_org and cari_code=target_cari_code;

  update public.z_code_registry
  set is_active=false,updated_by=auth.uid(),updated_at=now()
  where organization_id=target_org and cari_code=target_cari_code;

  if linked_dealer is not null then
    update public.organization_dealers
    set is_z_code=false,updated_by=auth.uid(),updated_at=now()
    where organization_id=target_org and id=linked_dealer;
  end if;
end;
$$;

grant execute on function public.remove_z_code_registry(uuid,text) to authenticated;

select
  count(*) filter(where is_active) as active_z_records,
  count(*) filter(where is_active and dealer_id is not null) as linked_to_dealer,
  count(*) filter(where is_active and dealer_id is null) as unlinked_z_records
from public.z_code_registry;
