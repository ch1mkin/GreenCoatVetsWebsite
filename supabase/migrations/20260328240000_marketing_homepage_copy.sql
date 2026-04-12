-- Editable homepage headline, tagline, navbar call CTA (super-admin managed).

alter table public.marketing_site_settings
  add column if not exists homepage_copy jsonb not null default '{}'::jsonb;

comment on column public.marketing_site_settings.homepage_copy is
  'Optional keys: hero_line1, hero_gradient, hero_tagline, navbar_call_display, navbar_call_tel_href (tel:+91...). Empty strings clear overrides.';
