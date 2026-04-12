# GreenCoatVets — Mobile (`apps/mobile`)

Expo (React Native) app for clinic staff and pet owners.

## Run

**Always use the `apps/mobile` folder as the Expo project root.** If you run `npx expo start` from the **monorepo root**, Expo reads the root `package.json` (no `main`), falls back to `expo/AppEntry.js`, and you get: `Unable to resolve "../../App" from "node_modules/expo/AppEntry.js"`.

From repo root (recommended):

```bash
npm run dev:mobile
```

Other valid options:

```bash
cd apps/mobile && npx expo start
# or, from monorepo root without cd:
npx expo start ./apps/mobile
```

Clear Metro cache when needed: `npx expo start -c` (still pass the app path if not inside `apps/mobile`).

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (e.g. in `.env` — use `expo-constants` / app config if you add env loading).

### Owner store checkout (Razorpay)

Pet owners can browse the **Shop** tab, add items to a cart, enter delivery details, and pay **in-app** via **Razorpay** (WebView). This requires:

1. **`EXPO_PUBLIC_WEBSITE_URL`** — Base URL of the **Next.js marketing** app (same deployment that runs `/api/store/razorpay/create-order` and `/api/checkout`). Example: `https://your-site.vercel.app` (no trailing slash).
2. **Razorpay keys** configured on the server (platform payment settings or `RAZORPAY_*` env on the website). **Test keys** (`rzp_test_*`) run in test mode; the app shows a reminder before the payment sheet opens.
3. Run **`npm install`** in `apps/mobile` so **`react-native-webview`** is installed (declared in `package.json`).

Checkout uses the same Supabase session as the app; the account must have an **owner** row for the clinic. Delivery cities match the website (Chandigarh / Mohali / Panchkula).

## Auth session storage (Supabase)

We **do not** use `@react-native-async-storage/async-storage` for Supabase auth. It often breaks in **Expo Go** (`Native module is null` / v3 “legacy storage” errors, or stale Metro caches).

Session keys are persisted with **`expo-file-system`** in the app sandbox (`salhantech-supabase-auth-kv.json`). No AsyncStorage native module required.

## Safe area

The app uses **`react-native-safe-area-context`** (`SafeAreaProvider` + `SafeAreaView`) instead of React Native’s deprecated `SafeAreaView`.

## Grant clinic admin (SQL)

Run in **Supabase → SQL Editor** (service role / postgres). Replace email and clinic slug. See `../../supabase/snippets/assign_clinic_admin.sql` for the full snippet.

```sql
select public.assign_user_clinic_role(
  (select id from auth.users where lower(email) = lower('you@example.com') limit 1),
  (select id from public.clinics where slug = 'your-clinic-slug' limit 1),
  'clinic_admin'::public.app_role,
  'Your Name',
  null
);
```

## UI theme

Shared palette and cards live in `src/theme/theme.ts` and `src/theme/commonStyles.ts` (VetCare-inspired greens and cool neutrals). Login uses `expo-linear-gradient`; tab screens use the same tokens for a consistent clinical look.

## QR invite onboarding

On **Create account** (or login), paste an invite token or tap the **QR** icon next to the invite field to open the camera and scan a clinic QR. After a successful scan, the invite field is replaced by a confirmation banner (role + clinic name via `peek_clinic_role_invite`), and **sign-up** only asks for **email and password**; the invite is consumed after signup + sign-in via `consume_clinic_role_invite`.

Requires migration `20260321120000_peek_invite_app_users_manual_roles.sql` (peek RPC + `consume` updates). Rebuild dev client if you add native permissions (`expo-camera` plugin in `app.json`).

## Manual roles in `app_users`

Super admins can set **`manual_clinic_slug`** (FK → `clinics.slug`, **dropdown of slugs** in Table Editor) or **`manual_clinic_id`**, plus **`manual_role`** (enum dropdown). A trigger calls `assign_user_clinic_role`. See `../../supabase/snippets/assign_clinic_admin.sql` and migration `20260321130000_app_users_manual_clinic_slug.sql`.

## Login vs signup

- **Log in**: email + password only (no invite / QR).
- **Create account**: optional invite (paste or QR scan), then email + password.
