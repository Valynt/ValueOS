# Layout & Grid Guidelines

Consistent layout keeps ValueOS surfaces aligned across apps (VOSAcademy, ValyntApp, MCP Dashboard). Use the shared container and spacing tokens to keep gutters, max widths, and grid gaps predictable.

## Container Usage

Use the global `.container` utility for page-level sections. It centers content, applies responsive gutters, and caps the max width.

- **Max width:** `--container-max` (1280px)
- **Gutters:**
  - Mobile: `--container-padding-sm` (16px)
  - Tablet: `--container-padding-md` (24px)
  - Desktop: `--container-padding-lg` (32px)

```html
<section class="container">
  <header class="space-y-2">
    <h1>Page title</h1>
    <p>Intro copy</p>
  </header>
</section>
```

### Narrower content blocks

For narrow sections, pair `.container` with a max-width utility.

```html
<section class="container max-w-3xl">
  <article class="space-y-4">
    <h2>Focused content</h2>
    <p>Keep text lines readable with a max width.</p>
  </article>
</section>
```

## Grid Structure

Use CSS grid for consistent alignment across sections. Pair `grid-cols-*` with token-backed gaps.

- **Baseline gaps:** `gap-4` (32px) for primary grid separation.
- **Tight gaps:** `gap-2` (16px) for dense toolbars or meta content.
- **Section gaps:** `gap-6` (48px) for page-level layout.

```html
<section class="container">
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    <div class="rounded-lg border p-6">Card A</div>
    <div class="rounded-lg border p-6">Card B</div>
    <div class="rounded-lg border p-6">Card C</div>
  </div>
</section>
```

## Spacing Tokens

Align spacing with the shared tokens (mapped to Tailwind values):

- `--space-1` → `0.5rem` (Tailwind `2`)
- `--space-2` → `1rem` (Tailwind `4`)
- `--space-3` → `1.5rem` (Tailwind `6`)
- `--space-4` → `2rem` (Tailwind `8`)
- `--space-6` → `3rem` (Tailwind `12`)
- `--space-8` → `4rem` (Tailwind `16`)

Use these for padding, margin, and component gaps so layouts feel consistent across products.
