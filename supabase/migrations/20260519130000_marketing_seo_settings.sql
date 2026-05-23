alter table public.marketing_site_settings
  add column if not exists seo_settings jsonb not null default '{}'::jsonb;

comment on column public.marketing_site_settings.seo_settings is
  'SEO: google_site_verification (meta content), public_site_url override, last_sitemap_ping_at.';
