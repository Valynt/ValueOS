import type { CustomBrandingConfig } from "@/config/settingsMatrix";

const buildSvgDataUrl = (label: string, backgroundColor: string, accentColor: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="96" viewBox="0 0 320 96" role="img" aria-label="${label}"><rect width="320" height="96" rx="20" fill="${backgroundColor}"/><circle cx="52" cy="48" r="20" fill="${accentColor}"/><text x="92" y="58" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="700" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const TENANT_BRANDING_FIXTURE: CustomBrandingConfig = {
  organizationId: "org-fixture-branding",
  logoUrl: buildSvgDataUrl("Northwind Health", "#0f766e", "#fbbf24"),
  faviconUrl: buildSvgDataUrl("N", "#1d4ed8", "#f8fafc"),
  primaryColor: "#0f766e",
  secondaryColor: "#1d4ed8",
  fontFamily: "Inter",
};

export const TENANT_BRANDING_FIXTURE_NAME = "Northwind Health";
export const TENANT_BRANDING_FIXTURE_DOMAIN = "northwind-health.example";
