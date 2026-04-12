-- Pet owners may read clinic rows for clinics they belong to (for portal UI; has_clinic_access is staff-only).
drop policy if exists clinics_pet_owner_select on public.clinics;
create policy clinics_pet_owner_select on public.clinics
for select
to authenticated
using (
  exists (
    select 1
    from public.owners o
    where o.user_id = auth.uid()
      and o.clinic_id = public.clinics.id
  )
);
