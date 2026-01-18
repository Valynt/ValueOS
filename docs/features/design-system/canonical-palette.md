# Canonical palette mapping

The source-of-truth palette for ValueOS lives in `apps/ValyntApp/src/styles/valueos-palette.css`. It defines the shared primary/secondary/accent/neutral roles plus success/warning/error status colors, with light and dark variants using the same token names.

Apps should map their local semantic tokens to these canonical values instead of redefining raw hex/OKLCH/HSL colors. See:

- `apps/VOSAcademy/src/index.css`
- `apps/mcp-dashboard/src/index.css`
- `apps/ValyntApp/src/styles/ai-indigo-tokens.css`

If you need new semantic colors, add them to the canonical palette first and then map downstream tokens to those names.
