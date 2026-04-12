# Marketing website admin (`/admin`)

## No clinic in the database yet?

If there are **no** active `clinics` rows (or RLS still blocks anon reads until migrations are applied), the site uses a **placeholder** clinic so pages don’t crash:

- Default display name: **GreenCoatVets** / slug `greencoatvets`
- Override with env: `NEXT_PUBLIC_FALLBACK_CLINIC_NAME`, `NEXT_PUBLIC_FALLBACK_CLINIC_SLUG`

After you seed clinics and apply migrations (`clinics_select_active_public`, etc.), real data is used automatically.

## Apply database migration

Run migrations (including marketing site, blog RPCs, analytics, `marketing_editor` role):

```bash
# from repo root, using Supabase CLI
supabase db push
```

Relevant files include `marketing_site_settings`, `marketing_locations`, `marketing_footer_groups` / `marketing_footer_links`, `marketing_site_page_views`, `blog_posts` / `blog_categories`, and RPCs `get_public_blog_posts`, `get_public_blog_post_by_slug`, etc.

## Who can sign in?

### Super admin (`public.is_super_admin()`)

- Listed in `platform_super_admins`, **or**
- Have an active `user_clinic_memberships` row with `role = 'super_admin'`.

Full access: dashboard, site settings, locations, **footer** (columns + links), **traffic**, blog (all clinics).

### Marketing editor (`app_role = marketing_editor`)

- Assign an active `user_clinic_memberships` row: `role = 'marketing_editor'`, `clinic_id = <the clinic this site serves>`.

**Blog-only access:** they can manage `blog_posts` / `blog_categories` for that clinic only. They are **not** granted normal tenant staff access (appointments, etc.) via `has_clinic_access()`.

There is **no sign-up** on this site. Create users in the main SaaSClinics app / Supabase Auth, then grant roles in SQL or your admin tooling.

## Routes

| URL | Who | Purpose |
|-----|-----|--------|
| `/admin/login` | Editors + super | Email + password (Supabase Auth) |
| `/admin` | Super | Dashboard |
| `/admin/settings` | Super | Default clinic, image URLs, footer social links — saves merge with existing DB values; success/error banners after save |
| `/admin/locations` | Super | CRUD for public `/locations` list |
| `/admin/traffic` | Super | Anonymous page-view counts (paths only) |
| `/admin/footer` | Super | Footer columns and links for the public marketing site |
| `/admin/blog` | Super + marketing editor | List / edit posts |

## Public blog

- Listing: `/blog` — reads via `get_public_blog_posts` / `get_public_blog_categories_list` / `get_public_blog_tag_counts` (scoped by resolved clinic).
- Detail: `/blog/[slug]` — `get_public_blog_post_by_slug`.

Posts are **hand-written** (Markdown / optional HTML) or marked **AI-assisted** via `ai_generated`; only `status = published` rows are returned.

## Traffic

- A small client beacon sends `POST /api/analytics/pulse` with `{ path }` on public navigations (not `/admin`).
- Rows append to `marketing_site_page_views`; **only super admins** can `SELECT` (RLS).

## Pet owner portal (website)

- **Sign up** — `/signup` creates Auth user, then `POST /api/register-owner` links an `owners` row to the **resolved clinic** (same rules as the rest of the site: host match → else `marketing_site_settings.default_clinic_id` → first active clinic).
- **Routes** — `/account` (hub), `/account/pets` (register pets), `/account/appointments`, `/account/visits`, `/book`.
- **Included** — Book appointments, list pets, see appointment list and **visit summaries** (date / pet / branch / status label only).
- **Excluded on web** — Prescriptions, medical records, file attachments, and downloadable assets remain **staff-only** in RLS; the portal uses `get_owner_portal_visit_summaries` instead of exposing the `visits` table directly.
- Apply migration `20260324120000_owner_portal_rls_and_rpc.sql` for owner RLS on `pets` / `appointments`, RPCs (`get_public_branches_for_clinic`, `get_public_booking_doctors`, `get_owner_portal_visit_summaries`), and limited `staff_profiles` read for booked doctors.
- Apply **`20260325120000_clinics_pet_owner_select.sql`** so pet owners can `SELECT` their clinic row (real name in the portal). The portal resolves **`owners.clinic_id`** (and prefers a row matching the current marketing `resolveClinic()` when you have several).

## Behaviour

- **Default clinic & branding** — If the request host does not match a clinic `subdomain` / `custom_domain`, `resolveClinic()` uses (in order): `marketing_site_settings.website_branded_for_clinic_id` → `default_clinic_id` → first active clinic. Set **Website branded for** in `/admin/settings` for the primary tenant this deployment represents; **Default clinic** is the fallback when branding is empty.
- **Images** — Keys in `homepage_images` override built-in placeholder URLs (hero, map strip, facility cards, etc.).
- **Locations** — If `marketing_locations` has **no** rows, the site uses code defaults in `src/lib/marketing/default-locations.ts`. As soon as you add one row in admin, **only** database rows are shown.
- **Footer** — Public footer link columns come from `marketing_footer_groups` + `marketing_footer_links` (active links only). If the `marketing_footer_*` tables are missing (migration not applied), the site falls back to built-in defaults in `src/lib/marketing/footer-nav.ts`. Super admins manage columns and links at `/admin/footer`.
- **Store & checkout** — Public `/store` and `/checkout` are scoped to the same resolved clinic as the rest of the site. **Products are not created in the marketing admin**; clinic owners (clinic admins) and platform super admins add catalog rows in the **main web app** → **Ecommerce**. Env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (see `.env.example`). Checkout uses Razorpay Checkout; delivery address is limited to **Chandigarh, Mohali, Panchkula** on the form. Apply migration `20260325200000_place_order_cart_security_definer_store_rls.sql` for storefront RLS + secure `place_order_cart_atomic`.
