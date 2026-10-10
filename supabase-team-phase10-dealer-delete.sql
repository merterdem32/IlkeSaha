-- İlke Saha - Faz 10
-- Yanlış eklenen bayilerin, kendi sorumlusundaki saha personeli veya yönetici
-- tarafından silinebilmesi için organization_dealers DELETE politikasını genişletir.
-- Uygulama tarafı ziyaret/ödeme geçmişi olan bayilerin kalıcı silinmesini ayrıca engeller.

alter table public.organization_dealers enable row level security;

drop policy if exists "org_dealers_manager_delete" on public.organization_dealers;
drop policy if exists "org_dealers_delete" on public.organization_dealers;

create policy "org_dealers_delete" on public.organization_dealers
for delete using (
  public.is_org_member(organization_id)
  and (
    public.is_org_manager(organization_id)
    or assigned_user_id = auth.uid()
  )
);

grant delete on public.organization_dealers to authenticated;
