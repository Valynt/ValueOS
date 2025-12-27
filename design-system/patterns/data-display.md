# Data Display Patterns

Valynt is a data-heavy application. How we present numbers matters.

## Key Performance Indicators (KPIs)

Top-level metrics that drive decisions.

- **Label**: Uppercase, Muted (`text-xs font-medium text-muted-foreground`).
- **Value**: Large, Monospace (`text-3xl font-mono`).
- **Trend**: Small, Colored (`text-sm text-success` for +12%).

## Tables

For tabular data sets.

- **Header**: `bg-surface-2`, `text-xs uppercase`.
- **Rows**: Hover effect (`hover:bg-surface-2`).
- **Alignment**:
  - Text: **Left** Aligned.
  - Numbers: **Right** Aligned (Monospace).
  - Actions: **Right** Aligned.

## Charts

- **Colors**: Use the Graph Palette (Tokens: `grey-500` for base, `teal-500` for primary).
- **Tooltips**: Essential for granular data inspection.
- **Axes**: Minimal lines. Use grid lines sparingly.

## Empty States

When no data exists.

- **Illustration**: Subtle, monoline or low-contrast.
- **Message**: "No data yet."
- **Action**: "Import Data" (Primary Button).
