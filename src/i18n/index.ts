import { DEFAULT_LOCALE, LocaleCode, SUPPORTED_LOCALES, localeMetadata } from './config';
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';

type Messages = Record<string, string>;

type LocaleResources = Record<LocaleCode, Messages>;

const resources: LocaleResources = {
  en: enCommon,
  es: esCommon,
};

export function resolveLocale(requested?: string): LocaleCode {
  if (!requested) return DEFAULT_LOCALE;
  const normalized = requested.split('-')[0] as LocaleCode;
  return SUPPORTED_LOCALES.includes(normalized) ? normalized : DEFAULT_LOCALE;
}

export function getMessage(key: string, locale?: string): string {
  const resolvedLocale = resolveLocale(locale);
  const messages = resources[resolvedLocale] || resources[DEFAULT_LOCALE];
  return messages[key] ?? resources[DEFAULT_LOCALE][key] ?? key;
}

export function getSupportedLocales() {
  return SUPPORTED_LOCALES.map((code) => ({
    code,
    ...localeMetadata[code],
  }));
}

export const i18n = {
  resources,
  resolveLocale,
  getMessage,
  supported: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
};
