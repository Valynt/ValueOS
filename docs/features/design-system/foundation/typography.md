# Typography

Valynt uses a purposeful pairing of **Inter** for UI readability and **JetBrains Mono** for data density and code precision.

## Font Families

| Token         | Family             | Fallback                | Usage                                                  |
| ------------- | ------------------ | ----------------------- | ------------------------------------------------------ |
| `--font-sans` | **Inter**          | `system-ui, sans-serif` | General UI, navigation, headings, body.                |
| `--font-mono` | **JetBrains Mono** | `monospace`             | Usage: `KPIs`, `Financial Data`, `Code Blocks`, `IDs`. |

## Scale & Hierarchy

We follow a predefined type scale to maintain rhythm.

| Token         | Size                | Line Height | Usage                                 |
| ------------- | ------------------- | ----------- | ------------------------------------- |
| `--text-xs`   | `12px` (`0.75rem`)  | `1rem`      | Labels, badges, captions.             |
| `--text-sm`   | `14px` (`0.875rem`) | `1.25rem`   | **Default Body**. Inputs, table rows. |
| `--text-base` | `16px` (`1rem`)     | `1.5rem`    | Standard Body, subsection headers.    |
| `--text-lg`   | `18px` (`1.125rem`) | `1.75rem`   | Card titles, small headings.          |
| `--text-3xl`  | `30px` (`1.875rem`) | `2.25rem`   | Page Titles, Key Metrics.             |
| `--text-5xl`  | `48px` (`3rem`)     | `1`         | Marketing headers, large stats.       |

## Weights

- **Regular (400)**: Standard body text.
- **Medium (500)**: Interactive elements (Buttons, Inputs), Table Headers.
- **Semibold (600)**: Headings, emphasized data.

## Guidelines

1. **Data is Monospace**. Always use `font-mono` for financial figures, percentages, and IDs to ensuring tabular alignment.
2. **Hierarchy via Contrast**. Use color (`text-muted`) to establish hierarchy before changing font size.
3. **Line Height**. Tighter line heights for headings (`1.1`), looser for body text (`1.5`).
