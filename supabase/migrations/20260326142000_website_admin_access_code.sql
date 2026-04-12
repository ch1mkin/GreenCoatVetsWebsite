-- Website marketing admin login gate code (super-admin controlled).

alter table public.platform_branding
  add column if not exists website_admin_access_code text;

update public.platform_branding
set website_admin_access_code = coalesce(nullif(trim(website_admin_access_code), ''), '15072005')
where id = 'default';

comment on column public.platform_branding.website_admin_access_code is
  'Numeric gate code for website /admin/login access modal. Super admin can rotate from web super-admin panel.';
