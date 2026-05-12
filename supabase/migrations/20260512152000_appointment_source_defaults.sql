alter table public.appointments
  alter column booking_source set default 'clinic_portal';

update public.appointments
set booking_source = 'clinic_portal'
where booking_source = 'owner_portal'
  and coalesce(owner_intake->>'consent_accepted', 'false') <> 'true';
