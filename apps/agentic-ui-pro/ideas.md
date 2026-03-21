# Agentic UI Pro — Design Brainstorm

<response>
<text>
## Idea 1: Brutalist Intelligence Terminal

**Design Movement:** Neo-Brutalism meets developer tooling (Linear × Vercel × Raycast)

**Core Principles:**
- Raw information density — no decorative chrome
- Monospaced type for data, sans-serif for prose
- Borders as structure, not decoration
- Everything earns its place on screen

**Color Philosophy:** Near-black background (#0a0a0b), off-white text (#e8e8e6), electric indigo (#6366f1) as the single accent. The palette communicates: "this is a serious instrument." No gradients except subtle noise texture on the hero.

**Layout Paradigm:** Left-anchored persistent sidebar (240px) + full-height main content area. No centered hero sections. The landing page uses an asymmetric split: 40% left column with product statement, 60% right with a live pattern grid preview.

**Signature Elements:**
- Hairline borders (1px, 10% opacity) creating grid cells
- Monospaced code snippets inline in pattern cards
- Status indicators (green dot = agentic-ready, amber = HITL required)

**Interaction Philosophy:** Keyboard-first. Command palette (⌘K) as primary navigation. Hover reveals metadata overlays. No animations except purposeful transitions.

**Animation:** Fade-in on route change (150ms ease-out). Code blocks type-in on first render. No bounce, no spring — only linear or ease-out.

**Typography System:** JetBrains Mono for code/metadata + Inter for UI labels + Geist for headings. Tight line-height (1.3) for dense data.
</text>
<probability>0.08</probability>
</response>

<response>
<text>
## Idea 2: Obsidian Enterprise — Dark Precision

**Design Movement:** Enterprise SaaS Dark Mode (Figma × Notion × Linear dark themes)

**Core Principles:**
- Layered depth through subtle elevation (3 background levels)
- Information hierarchy through size + weight, not color
- Restrained use of color — only for semantic meaning
- Sidebar as command center, not just navigation

**Color Philosophy:** Deep slate background (oklch 0.12), mid-tone cards (oklch 0.17), borders at 8% white. Primary accent: electric blue (oklch 0.55 0.22 260). Secondary: amber for warnings, emerald for success. The palette says "production system" not "marketing site."

**Layout Paradigm:** Fixed left sidebar (260px) with icon+label nav + collapsible sections. Main area uses a 12-column grid. Landing page: full-bleed dark hero with large type + animated pattern grid below the fold. Browse page: masonry-style pattern cards.

**Signature Elements:**
- Gradient border on active/hover cards (blue→purple, 1px)
- Pill badges for categories with semantic colors
- Inline code previews in pattern cards with syntax highlighting

**Interaction Philosophy:** Hover-to-reveal secondary actions. Smooth sidebar collapse. Search as first-class citizen (always visible in topbar).

**Animation:** Framer Motion layout animations for filter transitions. Cards fade+slide up on load (staggered, 40ms delay). Sidebar items slide in on mount.

**Typography System:** Space Grotesk (headings, bold, geometric) + Inter (body, UI) + JetBrains Mono (code). Heading scale: 36/28/22/18/14px.
</text>
<probability>0.09</probability>
</response>

<response>
<text>
## Idea 3: Structured Light — Precision Minimal

**Design Movement:** Swiss Grid meets SaaS tooling (Stripe Docs × Vercel Dashboard × Linear)

**Core Principles:**
- White space as primary organizational tool
- Typography-driven hierarchy — no decorative elements
- Strict grid discipline (8px base unit)
- Color used only for state and action

**Color Philosophy:** Pure white background, zinc-900 text, zinc-100 borders. Single accent: a deep cobalt (#1d4ed8) for interactive elements. The restraint communicates confidence and precision.

**Layout Paradigm:** Top navigation bar + full-width content. Landing page uses a large asymmetric type lockup (left-heavy) with a right-side interactive demo. Browse page uses a tight 3-column card grid with left filter rail.

**Signature Elements:**
- Large display numbers for stats/counts
- Underline-style active states (not background fills)
- Thin horizontal rules as section dividers

**Interaction Philosophy:** Everything responds to hover with a subtle background shift. Focus rings are visible and styled. No modal overuse — prefer inline expansion.

**Animation:** Minimal — only opacity transitions (200ms). No movement unless conveying state change.

**Typography System:** Syne (display headings, geometric, distinctive) + DM Sans (body, readable) + Fira Code (code). Heading scale: 48/36/24/18/14px.
</text>
<probability>0.07</probability>
</response>

---

## Selected Design: Idea 2 — Obsidian Enterprise

**Rationale:** This product is a serious internal intelligence tool for builders of AI-native SaaS. The dark, layered, enterprise aesthetic directly mirrors the environment where it will be used (dark-mode developer tools, Figma, Linear, VS Code). The electric blue accent provides clear interactive affordance without distraction. The sidebar-first layout supports the dense navigation this product requires.
