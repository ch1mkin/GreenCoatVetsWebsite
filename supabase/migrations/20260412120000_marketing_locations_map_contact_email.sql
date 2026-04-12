-- Interactive map pins for /locations (lat/lng from super admin).
alter table public.marketing_locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

comment on column public.marketing_locations.latitude is
  'Optional WGS84 latitude for Leaflet map pin; null hides pin until set.';
comment on column public.marketing_locations.longitude is
  'Optional WGS84 longitude for Leaflet map pin; null hides pin until set.';

-- Contact form notification recipient (marketing site); falls back to clinic.support_email in app if empty.
alter table public.marketing_site_settings
  add column if not exists contact_form_recipient_email text;

comment on column public.marketing_site_settings.contact_form_recipient_email is
  'Super admin: inbox for public /contact form notifications (SMTP).';
