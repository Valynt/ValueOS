# Card Component

Cards contain content and actions about a single subject. They are the fundamental building blocks of the Valynt dashboard.

## Variants

| Variant         | Visual                           | Usage                                       |
| --------------- | -------------------------------- | ------------------------------------------- |
| **Default**     | `bg-surface-2`, `border-default` | Standard content container.                 |
| **Elevated**    | `bg-surface-2`, `shadow-md`      | Interactive or floating cards.              |
| **Outline**     | Transparent, `border-default`    | Grouping content without background weight. |
| **Interactive** | Default style + Hover State      | Clickable cards (e.g., selection items).    |

## Anatomy

1. **Container**: Rounded corners (`radius-md`).
2. **Header** (Optional): Title + Actions.
3. **Body**: Main content area.
4. **Footer** (Optional): Summary or Action buttons.

## Spacing

- **Padding**: Standard padding is `--space-3` (24px) or `--space-4` (32px) for large cards.
- **Header/Footer**: Often separated by a border (`border-default`).

## Usage Rules

✅ **DO** use consistent heights for cards in a grid row.
✅ **DO** categorize content clearly (e.g., "Active Alerts", "KPIs").
❌ **DON'T** nest cards inside cards (use spacing/dividers instead).

## Code Example

```tsx
<div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors">
  <div className="flex justify-between items-center mb-4">
    <h3 className="text-lg font-semibold text-foreground">Value Hypothesis</h3>
    <Badge variant="success">Active</Badge>
  </div>
  <p className="text-muted-foreground text-sm">
    Reduce MRO costs by optimized inventory tracking.
  </p>
</div>
```
