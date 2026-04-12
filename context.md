# Veterinary Clinic SaaS - Architecture Context

## Product Scope

Production-ready multi-tenant Veterinary Clinic Management SaaS with:
- Internal SaaS dashboard (`apps/web`) for clinic operations.
- Public clinic websites (`apps/website`) for marketing, booking, blog, and store.
- Mobile app (`apps/mobile`) for pet owners and clinic staff.
- Shared backend on Supabase (PostgreSQL, Auth, Storage, Edge Functions).

Each tenant is a clinic. Each clinic can have multiple branches, staff, owners, pets, inventory, appointments, visits, ecommerce orders, and blog content.

---

## Architectural Decisions

### 1) Multi-Tenancy Model
- **Chosen model**: single database, shared schema, row-level isolation by `clinic_id`.
- **Why**: best balance of cost, operational simplicity, and scale for SaaS at this stage.
- **How isolation works**:
  - Every tenant-owned table includes `clinic_id`.
  - RLS policies (to be added in next migration) enforce tenant access using authenticated user context.
  - Global platform entities (for super admin) are separated from tenant records.

### 2) Branch-Level Operations
- Branch-level entities include `branch_id` for scheduling, inventory, and staffing control.
- Cross-branch reporting remains possible through clinic-level aggregation.

### 3) Role & Permission Design
- Auth identity is in `auth.users`.
- App-level role assignment is in `public.staff_profiles` and `public.user_clinic_memberships`.
- Supports roles: `super_admin`, `clinic_admin`, `branch_admin`, `doctor`, `receptionist`, `pet_owner`.
- Designed for RBAC now and optional ABAC extension later.

### 4) Public Website + SaaS Integration
- Public website reads tenant-aware content from Supabase by hostname/subdomain mapping.
- Booking on public site writes directly into shared `appointments` pipeline.
- Store orders from public website write into `orders`/`order_items` and adjust `inventory_items`.
- Blog/CMS content authored in SaaS appears on public website.

### 5) Data Integrity and Auditability
- UUID primary keys.
- Normalized schema with explicit foreign keys.
- Timestamp columns (`created_at`, `updated_at`) on operational tables.
- Status fields use PostgreSQL enums for consistency.
- Event timeline modeled through `visits`, `medical_records`, `vaccination_records`, and attachments.

### 6) File Storage
- Medical files (x-rays, reports, discharge docs), pet photos, and blog assets in Supabase Storage.
- Metadata references stored in relational tables (`file_attachments`).

### 7) Performance & Scalability
- Indexes on high-cardinality and hot-filter columns: `clinic_id`, `branch_id`, `doctor_id`, `status`, and time columns.
- Designed to support read models/materialized views for analytics in later phases.

---

## Monorepo Layout

```txt
/apps
  /web        -> SaaS dashboard (Next.js 14, App Router)
  /website    -> Public clinic website (Next.js 14, App Router)
  /mobile     -> Expo React Native app
/packages
  /ui         -> shared UI primitives/components
  /types      -> shared TypeScript types and DTO contracts
  /lib        -> shared utility libraries and SDK wrappers
  /api        -> typed API clients, query keys, and service interfaces
/supabase
  /migrations -> SQL schema + RLS + functions
/context.md   -> architecture source of truth
```

---

## Initial Domain Model (Implemented in Migration 1)

- Platform and tenant hierarchy:
  - `clinics`
  - `branches`
  - `user_clinic_memberships`
  - `staff_profiles`

- Pet care:
  - `owners`
  - `pets`
  - `appointments`
  - `visits`
  - `medical_records`
  - `prescriptions`
  - `prescription_items`
  - `vaccination_records`

- Inventory and pharmacy:
  - `suppliers`
  - `inventory_items`
  - `inventory_movements`
  - `purchase_orders`
  - `purchase_order_items`

- Ecommerce:
  - `product_categories`
  - `products`
  - `product_reviews`
  - `orders`
  - `order_items`

- CMS and content:
  - `blog_categories`
  - `blog_posts`

- Notifications:
  - `notifications`

- Files and assets:
  - `file_attachments`

---

## Public Website Tenant Routing

Tenant resolution strategy:
1. Parse request host.
2. Resolve clinic by `custom_domain` or `subdomain`.
3. Load website content/config scoped by resolved `clinic_id`.
4. Render SEO metadata and route content dynamically.

Planned routes in `apps/website`:
- `/`
- `/about`
- `/services`
- `/services/[slug]`
- `/doctors`
- `/blog`
- `/blog/[slug]`
- `/store`
- `/product/[slug]`
- `/cart`
- `/checkout`
- `/contact`

---

## Delivery Plan (Execution-Oriented)

1. **Foundation (current)**:
   - Monorepo scaffold.
   - Core schema migration.
2. **Security**:
   - RLS policies + helper SQL functions for tenant membership.
3. **Auth & Identity**:
   - Supabase Auth + profile bootstrap + role guards.
4. **Core Operations**:
   - Owner/pet CRUD, appointment scheduling, visit workflows.
5. **Clinical Depth**:
   - Prescriptions, vaccination reminders, document uploads.
6. **Commerce**:
   - Product catalog, cart/checkout, Razorpay flow, stock sync.
7. **Content & AI**:
   - CMS UI, AI blog generation and publishing pipeline.
8. **Mobile**:
   - Owner + doctor + receptionist role-focused mobile surfaces.
9. **Observability/Hardening**:
   - Audit logs, retries, alerting, and production runbooks.

---

## Notes and Constraints

- Current local Node version is below preferred engine for latest Expo/React Native dependencies. App scaffold succeeded, but upgrading Node to latest LTS patch is recommended before deeper mobile work.
- This phase focuses on foundation and schema. RLS and Edge Functions are next.
