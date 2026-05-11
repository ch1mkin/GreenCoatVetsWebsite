-- Remove deprecated Mohali TDI location from public marketing locations.
-- Public code also suppresses legacy rows until this migration is applied.

delete from public.marketing_locations
where lower(coalesce(name, '')) like '%mohali tdi%'
   or lower(coalesce(name, '')) like '%tdi pet clinic%'
   or lower(array_to_string(coalesce(address_lines, '{}'::text[]), ' ')) like '%taj plaza%'
   or id = 'default-mohali-tdi';
