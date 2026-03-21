export type BrandThemeOptions = {
  primary?: string;
  secondary?: string;
};

export const VALYNT_BRAND_PRIMARY = "#0F766E";
export const VALYNT_BRAND_SECONDARY = "#27E1C1";

const BRAND_PRIMARY = VALYNT_BRAND_PRIMARY;
const BRAND_SECONDARY = VALYNT_BRAND_SECONDARY;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace('#', '');
  if (normalized.length !== 6) return null;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): {
  h: number;
  s: number;
  l: number;
} {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }

    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hexToHslString(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb);
  return `${h} ${s}% ${l}%`;
}

function normalizeHex(hex: string): string | null {
  const normalized = hex.trim().toUpperCase();
  if (!/^#?[0-9A-F]{6}$/.test(normalized)) return null;
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}

function enforceBrandToken(
  value: string | undefined,
  fallback: string,
  role: "primary" | "secondary"
): string {
  const normalized = value ? normalizeHex(value) : null;
  if (!normalized) return fallback;
  if (normalized !== fallback) {
    // Brand overrides are blocked by policy; enforce VALYNT palette.
    console.warn(
      `[VALYNT] ${role} color overrides are not allowed. Using system token instead.`
    );
    return fallback;
  }
  return normalized;
}

export function applyBrandTheme(options: BrandThemeOptions = {}): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  const primary = enforceBrandToken(options.primary, BRAND_PRIMARY, "primary");
  const secondary = enforceBrandToken(
    options.secondary,
    BRAND_SECONDARY,
    "secondary"
  );

  const primaryHsl = hexToHslString(primary);
  const secondaryHsl = hexToHslString(secondary);

  if (primaryHsl) {
    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--ring', primaryHsl);
    root.style.setProperty('--status-success', primaryHsl);
  }

  if (secondaryHsl) {
    root.style.setProperty('--accent', secondaryHsl);
    root.style.setProperty('--status-info', secondaryHsl);
  }

  root.style.setProperty('--primary-foreground', '0 0% 100%');
  root.style.setProperty('--accent-foreground', '0 0% 100%');

  // Enforce dark-first rendering
  root.classList.add('dark');
}
