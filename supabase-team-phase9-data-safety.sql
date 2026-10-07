-- İlke Saha - Faz 9 / Veri Güvenliği
-- Kritik tablolardaki UPDATE ve DELETE işlemlerinden önce eski satırı değiştirilemez güvenlik geçmişine yazar.
-- Amaç: istemci hatası, yanlış senkronizasyon veya kullanıcı silmesi durumunda verinin geri getirilebilir olması.

create table if not exists public.data_change_history (
  id bigint generated always as identity primary key,
  organization_id uuid,
  table_name text not null,
  operation text not null check (operation in ('UPDATE','DELETE')),
  record_id text,
  old_data jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists idx_data_change_history_org_time
  on public.data_change_history(organization_id, changed_at desc);

create index if not exists idx_data_change_history_table_record
  on public.data_change_history(table_name, record_id, changed_at desc);

alter table public.data_change_history enable row level security;

-- Bilerek hiçbir normal istemci SELECT/INSERT/UPDATE/DELETE politikası tanımlanmıyor.
-- Bu tablo yalnızca SECURITY DEFINER trigger fonksiyonu tarafından yazılır.
-- Geri yükleme gerektiğinde Supabase SQL Editor / yönetici bakım işlemi kullanılır.

create or replace function public.capture_data_change_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_json jsonb;
  new_json jsonb;
  org_id uuid;
  rec_id text;
begin
  old_json := to_jsonb(old);

  if tg_op = 'UPDATE' then
    new_json := to_jsonb(new);

    -- Sadece updated_at / updated_by gibi teknik alanlar değiştiyse geçmişi şişirme.
    if (old_json - 'updated_at' - 'updated_by')
       is not distinct from
       (new_json - 'updated_at' - 'updated_by') then
      return new;
    end if;
  end if;

  begin
    org_id := nullif(old_json ->> 'organization_id','')::uuid;
  exception when others then
    org_id := null;
  end;

  rec_id := coalesce(
    old_json ->> 'id',
    old_json ->> 'dealer_id',
    old_json ->> 'user_id',
    old_json ->> 'cari_code'
  );

  insert into public.data_change_history(
    organization_id,
    table_name,
    operation,
    record_id,
    old_data,
    changed_by,
    changed_at
  ) values (
    org_id,
    tg_table_name,
    tg_op,
    rec_id,
    old_json,
    auth.uid(),
    now()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Var olan kritik tabloların tamamına güvenlik trigger'ı ekle.
do $$
declare
  t text;
  trigger_name text;
  tables text[] := array[
    'organization_dealers',
    'visits',
    'payment_promises',
    'meeting_notes',
    'personal_notes',
    'potential_dealers',
    'potential_visits',
    'daily_routes',
    'route_stops',
    'recurring_routes',
    'recurring_route_stops',
    'z_code_registry',
    'user_settings'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.'||t) is not null then
      trigger_name := 'trg_history_'||t;
      execute format('drop trigger if exists %I on public.%I', trigger_name, t);
      execute format(
        'create trigger %I before update or delete on public.%I for each row execute function public.capture_data_change_history()',
        trigger_name,
        t
      );
    end if;
  end loop;
end $$;

-- Koruma tablosunun kendisi uygulama tarafından yanlışlıkla değiştirilemesin.
revoke all on public.data_change_history from anon, authenticated;
revoke all on sequence public.data_change_history_id_seq from anon, authenticated;

-- Kontrol sorgusu:
-- select table_name, operation, count(*)
-- from public.data_change_history
-- group by table_name, operation
-- order by table_name, operation;
