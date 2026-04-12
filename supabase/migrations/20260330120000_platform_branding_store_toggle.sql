alter table public.platform_branding
add column if not exists website_store_enabled boolean not null default true;

update public.platform_branding
set website_store_enabled = coalesce(website_store_enabled, true)
where id = 'default';
