alter table public.clinics
add column if not exists website_store_enabled boolean not null default true;

update public.clinics
set website_store_enabled = coalesce(website_store_enabled, true);
