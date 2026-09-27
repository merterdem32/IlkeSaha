-- İlke Saha - Faz 8
-- Z Kodlu bayi sınıflandırması
-- Güvenli / eklemeli migration: mevcut bayi, koordinat, rut ve ziyaret verilerini silmez.

alter table public.organization_dealers
  add column if not exists cari_code text,
  add column if not exists is_z_code boolean not null default false;

create index if not exists idx_org_dealers_z_code
  on public.organization_dealers(organization_id,is_z_code);

create index if not exists idx_org_dealers_cari_code
  on public.organization_dealers(organization_id,cari_code)
  where cari_code is not null;

-- Kullanıcıdan gelen Excel + fotoğraf listesini eşleştirme tablosu.
-- match_text mevcut bayi adında aranır; böylece noktalama/uzun ünvan farkları
-- yüzünden eşleşme kaçırılmaz.
with z_seed(cari_code,match_text) as (
  values
    -- İstanbul / fotoğraf
    ('120.01.0448','FARUK ETE'),
    ('120.01.0434','OKAN BAYSAL'),
    ('120.01.0406','ONUR ALANLAR'),
    ('120.01.0399','GÖRKEM OTO'),
    ('120.01.0337','GÖKSUN ÖZTÜRK'),
    ('120.01.0326','GURUR GÜRBÜZ'),
    ('120.01.0237','NURCİHAN CEYLAN'),
    ('120.01.0200','AHMET KARA-PINARBAŞI'),
    ('120.01.0118','LİDER NEVA'),
    ('120.01.0055','SAĞLAM TRUCK'),
    ('120.01.0036','ALİ KESKİN'),

    -- Trakya Excel / Özel Kod 3 = Z KOD (Z KOD)
    ('120.01.0270','RECEP KÜÇÜK'),
    ('120.01.0230','YIL OTO YEDEK PARÇA'),
    ('120.01.0341','MUSTAFA HIZIR'),
    ('120.01.0339','CEM METİN'),
    ('120.01.0263','SAZLIDERELİ OTOMOTİV'),
    ('120.01.0250','CEMALETTİN TANIR'),
    ('120.01.0107','HASAN İŞGÖRÜR'),
    ('120.01.0423','HALİL ALPARSLAN'),
    ('120.01.0401','OSMAN MUMCU'),
    ('120.01.0340','İSMAİL KARAGÖZ'),
    ('120.01.0281','SERKAN PEKER'),
    ('120.01.0260','MUZAFFER ÖZTEN'),
    ('120.01.0167','SEDA BİRİNCİ'),
    ('120.01.0115','ÖZKAN KANA'),
    ('120.01.0480','BÜLENT BURMACI'),
    ('120.01.0279','HÜSNÜ KALYONCU'),
    ('120.01.0278','İBRAHİM ÇİZEN'),
    ('120.01.0256','VEMER OTOMOTİV'),
    ('120.01.0252','FATMA ATA'),
    ('120.01.0243','CEYHUN AVŞAR'),
    ('120.01.0226','ZEYNEL VE MUSTAFA SARSILMAZ'),
    ('120.01.0194','ERGÜL TERZİ'),
    ('120.01.0166','SAMİ ÖZER'),
    ('120.01.0128','MAHMUT KAYDI'),
    ('120.01.0127','YAHYA ACAR'),
    ('120.01.0045','DENGE HASAR'),
    ('120.01.0020','ÖZ OTO-EKREM ÖZYOLCU')
)
update public.organization_dealers d
set is_z_code=true,
    cari_code=coalesce(d.cari_code,z.cari_code),
    updated_at=now()
from z_seed z
where upper(d.name) like '%' || upper(z.match_text) || '%';

-- Doğrulama: kaç bayi işaretlendi ve hangileri eşleşmedi?
select
  count(*) filter (where is_z_code) as z_code_total,
  count(*) filter (where is_z_code and cari_code is not null) as z_code_with_cari_code
from public.organization_dealers;

with z_seed(cari_code,match_text) as (
  values
    ('120.01.0448','FARUK ETE'),
    ('120.01.0434','OKAN BAYSAL'),
    ('120.01.0406','ONUR ALANLAR'),
    ('120.01.0399','GÖRKEM OTO'),
    ('120.01.0337','GÖKSUN ÖZTÜRK'),
    ('120.01.0326','GURUR GÜRBÜZ'),
    ('120.01.0237','NURCİHAN CEYLAN'),
    ('120.01.0200','AHMET KARA-PINARBAŞI'),
    ('120.01.0118','LİDER NEVA'),
    ('120.01.0055','SAĞLAM TRUCK'),
    ('120.01.0036','ALİ KESKİN'),
    ('120.01.0270','RECEP KÜÇÜK'),
    ('120.01.0230','YIL OTO YEDEK PARÇA'),
    ('120.01.0341','MUSTAFA HIZIR'),
    ('120.01.0339','CEM METİN'),
    ('120.01.0263','SAZLIDERELİ OTOMOTİV'),
    ('120.01.0250','CEMALETTİN TANIR'),
    ('120.01.0107','HASAN İŞGÖRÜR'),
    ('120.01.0423','HALİL ALPARSLAN'),
    ('120.01.0401','OSMAN MUMCU'),
    ('120.01.0340','İSMAİL KARAGÖZ'),
    ('120.01.0281','SERKAN PEKER'),
    ('120.01.0260','MUZAFFER ÖZTEN'),
    ('120.01.0167','SEDA BİRİNCİ'),
    ('120.01.0115','ÖZKAN KANA'),
    ('120.01.0480','BÜLENT BURMACI'),
    ('120.01.0279','HÜSNÜ KALYONCU'),
    ('120.01.0278','İBRAHİM ÇİZEN'),
    ('120.01.0256','VEMER OTOMOTİV'),
    ('120.01.0252','FATMA ATA'),
    ('120.01.0243','CEYHUN AVŞAR'),
    ('120.01.0226','ZEYNEL VE MUSTAFA SARSILMAZ'),
    ('120.01.0194','ERGÜL TERZİ'),
    ('120.01.0166','SAMİ ÖZER'),
    ('120.01.0128','MAHMUT KAYDI'),
    ('120.01.0127','YAHYA ACAR'),
    ('120.01.0045','DENGE HASAR'),
    ('120.01.0020','ÖZ OTO-EKREM ÖZYOLCU')
)
select z.cari_code,z.match_text
from z_seed z
where not exists (
  select 1
  from public.organization_dealers d
  where upper(d.name) like '%' || upper(z.match_text) || '%'
)
order by z.cari_code;
