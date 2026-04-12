# SaaSClinics

Monorepo for a multi-tenant Veterinary Clinic Management SaaS:
- `apps/web` - internal SaaS dashboard
- `apps/website` - public clinic website
- `apps/mobile` - Expo mobile app
- `packages/*` - shared libraries
- `supabase` - schema migrations and backend config

## Quick start

```bash
npm install
npm run dev:web
```

See `context.md` for architecture and delivery context.

## Environment setup

1. Copy `.env.supabase.example` to `.env.supabase` and fill in your project credentials.
2. For web apps, copy:
   - `apps/web/.env.example` -> `apps/web/.env.local`
   - `apps/website/.env.example` -> `apps/website/.env.local`
3. For Expo, copy:
   - `apps/mobile/.env.example` -> `apps/mobile/.env`
