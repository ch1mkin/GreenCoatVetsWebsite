-- Retail-style product content: short summary for cards, gallery URLs for PDP (JSON array of strings).
alter table public.products
  add column if not exists summary text;

alter table public.products
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

-- Ensure gallery is always a JSON array (empty array default).
alter table public.products
  drop constraint if exists products_image_urls_is_array;

alter table public.products
  add constraint products_image_urls_is_array
  check (jsonb_typeof(image_urls) = 'array');
