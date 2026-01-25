# Component State Matrix

This matrix standardizes interactive states across core components. Use semantic tokens only.

## Buttons

| State     | Visual Treatment | Tokens |
| --------- | ---------------- | ------ |
| Default   | Solid fill, subtle shadow | `--primary`, `--primary-foreground`, `--shadow-1` |
| Hover     | Slight lift + darker tone | `--shadow-2`, `--primary` (85–90% tone) |
| Active    | Reduced shadow, stronger tone | `--shadow-1`, `--primary` (75–80% tone) |
| Focus     | 2px ring + 2px offset | `--ring`, `--background` |
| Disabled  | Reduced contrast + no shadow | `--muted`, `--muted-foreground`, `opacity: 0.6` |

## Inputs

| State     | Visual Treatment | Tokens |
| --------- | ---------------- | ------ |
| Default   | 1px border + neutral surface | `--input`, `--background` |
| Hover     | Border emphasis | `--border` |
| Focus     | Border + ring | `--ring`, `--background` |
| Error     | Border + ring in error | `--destructive` |
| Disabled  | Muted text + reduced contrast | `--muted`, `--muted-foreground` |

## Cards

| State     | Visual Treatment | Tokens |
| --------- | ---------------- | ------ |
| Default   | Surface + border | `--card`, `--border` |
| Hover     | Slight elevation | `--shadow-2` |
| Active    | Stronger border | `--ring` |
| Focus     | Focus ring (if interactive) | `--ring`, `--background` |

## Modals

| State   | Visual Treatment | Tokens |
| ------- | ---------------- | ------ |
| Default | Elevated surface + shadow | `--popover`, `--shadow-3` |
| Focus   | Focus ring on primary action | `--ring` |
| Disabled | Disable actions (buttons) | Button disabled tokens |
