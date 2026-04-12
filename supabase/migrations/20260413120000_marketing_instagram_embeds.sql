-- Super-admin curated Instagram post/reel URLs for homepage embeds (official embed.js; no visitor OAuth).

alter table public.marketing_site_settings
  add column if not exists instagram_embed_urls jsonb not null default '[]'::jsonb;

comment on column public.marketing_site_settings.instagram_embed_urls is
  'Array of Instagram post/reel permalinks (https://www.instagram.com/p|reel|tv/SHORTCODE/) shown on marketing homepage.';
