-- İlke Saha - Faz 7
-- Gün sonu raporlarında ödeme sözünün hangi gün kaydedildiğini doğru tut.

alter table public.payment_promises
  add column if not exists created_at timestamptz;

-- Mevcut kayıtları mümkün olduğunca gerçek oluşturulma zamanına yaklaştır.
update public.payment_promises
set created_at = coalesce(created_at, updated_at, now())
where created_at is null;

alter table public.payment_promises
  alter column created_at set default now();

alter table public.payment_promises
  alter column created_at set not null;

create index if not exists idx_payment_promises_org_created_at
  on public.payment_promises(organization_id, created_at);
