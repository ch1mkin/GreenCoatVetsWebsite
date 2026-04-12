drop policy if exists owners_policy on public.owners;

create policy owners_select_policy on public.owners
for select
using (
  public.has_clinic_access(clinic_id) or user_id = auth.uid()
);

create policy owners_insert_self_policy on public.owners
for insert
with check (
  user_id = auth.uid()
);

create policy owners_update_policy on public.owners
for update
using (
  public.has_clinic_access(clinic_id) or user_id = auth.uid()
)
with check (
  public.has_clinic_access(clinic_id) or user_id = auth.uid()
);
