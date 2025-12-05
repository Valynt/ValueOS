export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: LocaleCode = 'en';

export const localeMetadata: Record<LocaleCode, { label: string; direction: 'ltr' | 'rtl' }>
  = {
    en: { label: 'English', direction: 'ltr' },
    es: { label: 'Español', direction: 'ltr' },
  };
