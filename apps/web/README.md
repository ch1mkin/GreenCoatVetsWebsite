# SalhanTech Clinic Software — Web (`apps/web`)

Next.js (App Router) dashboard for clinic staff: appointments, records, inventory, ecommerce, **INR** payments, CMS (blog & services), analytics, and admin tools.

## Scripts

```bash
npm install          # from repo root or apps/web
npm run dev:web      # from repo root — local dev server
```

Configure `.env.local` from `.env.example` (Supabase URL, anon key, and any SMTP keys for notifications).

## Auth & roles

- **Super admin**: platform-wide routes (`/super-admin`, global reports).
- **Clinic admin**: full clinic module set including **Services CMS**, **Blog CMS**, **Payments**, **Ecommerce**.
- **Receptionist**: **Payments** plus front-desk flows (owners, pets, appointments, QR invites).
- Other roles: see `src/lib/auth/permissions.ts` (`getRoleModules`).

Unauthenticated users hit `/login`; role guards redirect from routes they cannot use.

## Design system

Shared UI: **`AppShell`**, Tailwind tokens in `tailwind.config.ts` (primary/surface/Material Symbols). Currency: **`formatInr()`** in `src/lib/format-currency.ts` — use for all money.

## Key routes

| Area        | Path                    |
|------------|-------------------------|
| Dashboard  | `/dashboard`            |
| Payments   | `/payments`             |
| Services CMS | `/services`           |
| Blog CMS   | `/blog`                 |
| Ecommerce  | `/ecommerce`            |
| Inventory  | `/inventory`            |

## Production checklist

- [ ] Env vars set (Supabase + optional Hostinger SMTP for email dispatch).
- [ ] RLS policies applied via Supabase migrations.
- [ ] Smoke-test login, one CRUD flow, and payment status update.
