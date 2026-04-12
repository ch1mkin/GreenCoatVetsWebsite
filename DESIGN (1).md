# Design System Specification: High-End Veterinary Management

## 1. Overview & Creative North Star: "The Clinical Sanctuary"
The design system is built upon the "Clinical Sanctuary" North Star. In the high-stress environment of veterinary medicine, the software must act as a calming, hyper-efficient partner—not a complex obstacle. We move away from the "data-heavy dashboard" trope by utilizing **Organic Precision**. 

This system breaks the "template" look by rejecting rigid borders in favor of **Tonal Topography**. By using generous whitespace (`spacing.20`) and intentional asymmetry in layout, we create a premium, editorial feel that suggests high-tech capability wrapped in human (and animal) empathy.

---

## 2. Colors & Surface Philosophy
Our palette transitions from the sterile whites of traditional clinics to the "Soft Mint" and "Deep Slate" of a modern boutique practice.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders to define sections. Layout boundaries must be achieved through background color shifts. 
*   *Example:* A navigation sidebar using `surface_container_low` should sit against a main content area of `surface`. Separation is felt, not seen.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, physical layers.
*   **Base:** `surface` (#f6fafe)
*   **Secondary Sections:** `surface_container_low` (#f0f4f8)
*   **Elevated Content (Cards):** `surface_container_lowest` (#ffffff)
*   **Overlays/Modals:** `surface_container_high` (#e4e9ed)

### The "Glass & Gradient" Rule
To inject "soul" into the SaaS experience, hero elements and primary CTAs should utilize a subtle linear gradient: `primary_container` (#36c497) to `primary` (#006c50) at a 135-degree angle. Floating action buttons or critical alerts should employ **Glassmorphism**: `surface_container_lowest` with 80% opacity and a `20px` backdrop-blur.

---

## 3. Typography: Editorial Authority
We pair the geometric friendliness of **Manrope** with the high-legibility "workhorse" **Inter**.

*   **Display & Headlines (Manrope):** Use `display-lg` to `headline-sm` for patient names and diagnostic summaries. These should feel authoritative yet approachable.
*   **Body & Titles (Inter):** All functional data, medical notes, and labels use Inter. 
*   **Hierarchy Note:** Use `on_surface_variant` (#3d4a43) for secondary metadata to create a sophisticated grey-scale contrast against the `on_background` (#171c1f) primary text.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are a last resort. Depth is communicated through the **Layering Principle**.

*   **Tonal Lift:** Place a `surface_container_lowest` card on a `surface_container` background. This creates a natural "pop" without visual clutter.
*   **Ambient Shadows:** If a floating element (like a mobile FAB or a dropdown) requires a shadow, use a custom blur: `0 12px 32px rgba(23, 28, 31, 0.06)`. The tint is derived from `on_surface`, never pure black.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke (e.g., in high-contrast modes), use `outline_variant` (#bbcac1) at **15% opacity**. Total opacity borders are strictly forbidden.

---

## 5. Components & Interface Patterns

### Buttons
*   **Primary:** Gradient fill (`primary_container` to `primary`). Corner radius: `xl` (1.5rem) for a friendly, "pill-like" feel.
*   **Secondary:** `secondary_container` (#d5e0f8) with `on_secondary_container` text. No border.
*   **Tertiary:** Ghost style. `primary` text with no background. Interaction state uses a `primary_fixed_dim` 10% opacity hover.

### Input Fields
*   **Style:** Background `surface_container_low`. Bottom-heavy padding (`spacing.3`). 
*   **Focus State:** Transition background to `surface_container_lowest` and add a `2px` "Ghost Border" of `primary` at 40% opacity.

### Cards & Lists
*   **The Divider Ban:** Never use horizontal lines to separate list items. Use `spacing.4` vertical gaps or alternating subtle tonal shifts between `surface` and `surface_container_low`.
*   **Patient Profile Cards:** Use `ROUND_EIGHT` (0.5rem) as the base, but use `xl` (1.5rem) for the outer container to create a "nested softness."

### Specialized Veterinary Components
*   **Vitals Chip:** Small, high-contrast chips using `tertiary_fixed` (#ffdeae) for urgent alerts (e.g., "High Temp") and `primary_fixed` (#75fac9) for stable metrics.
*   **Treatment Timeline:** A vertical track using `outline_variant` (10% opacity) with `primary` nodes. Use overlapping "Glass" cards for specific time-stamped events.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `tertiary` (Amber) sparingly—only for medical warnings or billing arrears.
*   **Do** embrace white space. If a layout feels "full," increase the spacing token by one tier (e.g., from `spacing.6` to `spacing.8`).
*   **Do** use asymmetrical image placement for clinic branding to break the "SaaS grid."

### Don't
*   **Don't** use 100% black text. Always use `on_background` (#171c1f) for better eye-strain management during long shifts.
*   **Don't** use sharp corners. Every element must adhere to the `Roundedness Scale`, specifically `DEFAULT` (0.5rem) for UI primitives and `xl` (1.5rem) for major containers.
*   **Don't** use standard "Success Green." Use the system's `primary` (#006c50) to maintain the signature teal-leaning brand identity.