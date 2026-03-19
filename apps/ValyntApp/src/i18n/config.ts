export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: LocaleCode = "en";

export const localeMetadata: Record<
  LocaleCode,
  { label: string; direction: "ltr" | "rtl"; productionReady: true }
> = {
  en: { label: "English", direction: "ltr", productionReady: true },
  es: { label: "Español", direction: "ltr", productionReady: true },
};

export const PSEUDO_LOCALE_CODE = "en-XA" as const;
export type PseudoLocaleCode = typeof PSEUDO_LOCALE_CODE;

export const NON_PRODUCTION_LOCALES = [PSEUDO_LOCALE_CODE] as const;
export type NonProductionLocaleCode = (typeof NON_PRODUCTION_LOCALES)[number];
