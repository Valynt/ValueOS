# Design System Specification: Modern Enterprise Visual Intelligence

## 1. Overview & Creative North Star
**Creative North Star: The Precision Curator**
This design system rejects the cluttered, "dashboard-heavy" tropes of traditional B2B SaaS. Instead, it adopts the persona of a high-end digital curator. The goal is to present complex AI-driven visual data with the clarity of a premium editorial publication.

We move beyond the "template" look by utilizing **Intentional Asymmetry** and **Tonal Depth**. By avoiding rigid grid lines and embracing expansive white space, we create an environment where data doesn't just sit on a page—it is showcased. The interface should feel authoritative through its restraint and innovative through its use of layered, translucent surfaces.

---

### 2. Colors & Surface Architecture
The palette is rooted in deep, trust-evoking navies and charcoals, punctuated by a high-energy "Electric Violet" tertiary accent.

#### The "No-Line" Rule
To maintain a premium, editorial feel, **1px solid borders are prohibited for sectioning.** Structural boundaries must be defined exclusively through background color shifts.
*   **The Logic:** If two areas need separation, place a `surface-container-low` (#f2f4f6) section directly against the `surface` (#f7f9fb) background.

#### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-transparent materials. Use the `surface-container` tiers to denote "altitude":
*   **Base Layer:** `surface` (#f7f9fb) for the main application background.
*   **Secondary Content:** `surface-container-low` (#f2f4f6) for sidebars or grouping.
*   **Actionable Cards:** `surface-container-lowest` (#ffffff) to provide a "lifted" appearance.
*   **Overlays/Modals:** `surface-container-highest` (#e0e3e5) for temporary high-focus elements.

#### Signature Textures & Glassmorphism
For high-impact areas like "Effectiveness Scores" or Hero Analytics, use **Glassmorphism**. Combine `surface_container_lowest` at 60% opacity with a `backdrop-blur` of 12px. Apply a subtle gradient transition from `primary_container` (#131b2e) to `on_tertiary_container` (#9863ff) for main CTA backgrounds to inject "visual soul."

---

### 3. Typography
We utilize **Inter** for its mathematical precision and neutral tone, allowing the visual AI content to remain the protagonist.

| Level | Token | Size | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | 3.5rem | 700 | Impactful data milestones. |
| **Headline** | `headline-md` | 1.75rem | 600 | Page titles & primary sections. |
| **Title** | `title-sm` | 1.0rem | 600 | Component headers & card titles. |
| **Body** | `body-md` | 0.875rem | 400 | Standard data & descriptions. |
| **Label** | `label-sm` | 0.6875rem | 500 | Uppercase metadata & overlines. |

**Editorial Contrast:** Pair `display-lg` numbers with `label-sm` descriptors. The extreme jump in scale conveys a modern, high-fashion data aesthetic.

---

### 4. Elevation & Depth
Depth is a tool for focus, not decoration.

*   **Tonal Layering:** Avoid shadows for static cards. Use the difference between `surface-container-low` and `surface-container-lowest` to create a "natural lift."
*   **Ambient Shadows:** For floating elements (menus/modals), use ultra-diffused shadows. 
    *   *Spec:* `0px 12px 32px rgba(25, 28, 30, 0.06)`. The tint is derived from `on_surface` to mimic natural light.
*   **The Ghost Border:** If a boundary is required for accessibility (e.g., in high-density tables), use the `outline_variant` (#c6c6cd) at **15% opacity**. Never use a 100% opaque border.

---

### 5. Components & Pattern Library

#### Buttons: The Kinetic Interaction
*   **Primary:** Solid `primary` (#000000) with `on_primary` (#ffffff) text. Use `xl` (1.5rem) roundedness for a modern feel.
*   **Tertiary (The "Vizit" Accent):** Use a gradient from `tertiary_fixed_dim` to `on_tertiary_container`. This is reserved for AI-generated insights or "Generate" actions.

#### Data Tables: The Fluid Ledger
*   **Rule:** Forbid the use of vertical and horizontal divider lines. 
*   **Spacing:** Use `spacing-2` (normal spacing) between rows. Use `surface_container_low` for the header row and hover states to define rows without "caging" them in lines.

#### Input Fields: Subtle Sophistication
*   **Style:** No borders. Use `surface_container_high` (#e6e8ea) as the fill. On focus, transition the background to `surface_container_highest` and apply a 2px "Electric Violet" (`on_tertiary_container`) bottom bar.

#### Effectiveness Scores (Signature Component)
*   **Visual:** A radial gauge using a `tertiary` (#ae7ddd) track with a `on_tertiary_container` (#9863ff) progress fill.
*   **Styling:** Place inside a `surface_container_lowest` card with an 8px (`DEFAULT`) corner radius. Apply a backdrop blur if the card sits over image content.

---

### 6. Do’s and Don’ts

#### Do
*   **Do** use asymmetrical margins. If a dashboard has a heavy left-hand visualization, leave the right-hand side with significantly more whitespace (`spacing-20`).
*   **Do** use `on_surface_variant` (#45464d) for secondary text to maintain a soft, sophisticated hierarchy.
*   **Do** apply the `DEFAULT` (8px) roundedness to all data containers to soften the "enterprise" feel.

#### Don’t
*   **Don't** use pure grey (#808080). Use our curated neutrals like `secondary` (#515f74) which have a deep navy undertone for a more premium feel.
*   **Don't** use "Drop Shadows" on everything. If a component isn't interactive or floating, it should rely on tonal shifts for separation.
*   **Don't** crowd the "Effectiveness Scores." These are the "hero" metrics; give them at least `spacing-10` of padding.