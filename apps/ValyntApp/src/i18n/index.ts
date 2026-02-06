import { DEFAULT_LOCALE, type LocaleCode, localeMetadata, SUPPORTED_LOCALES } from "./config";

type Messages = Record<string, string>;

type MessageLoader = () => Promise<Messages>;

const loaders: Record<LocaleCode, MessageLoader> = {
  en: () => import("./locales/en/common.json").then((module) => module.default as Messages),
  es: () => import("./locales/es/common.json").then((module) => module.default as Messages),
};

const messageCache = new Map<LocaleCode, Messages>();

export function resolveLocale(requested?: string): LocaleCode {
  if (!requested) return DEFAULT_LOCALE;
  const normalized = requested.split("-")[0] as LocaleCode;
  return SUPPORTED_LOCALES.includes(normalized) ? normalized : DEFAULT_LOCALE;
}

export async function loadMessages(requested?: string): Promise<Messages> {
  const locale = resolveLocale(requested);
  const cached = messageCache.get(locale);
  if (cached) {
    return cached;
  }

  const loader = loaders[locale] ?? loaders[DEFAULT_LOCALE];
  const messages = await loader();
  messageCache.set(locale, messages);
  return messages;
}

export async function getMessage(key: string, requested?: string): Promise<string> {
  const locale = resolveLocale(requested);
  const messages = await loadMessages(locale);

  if (messages[key]) {
    return messages[key];
  }

  const fallbackMessages = await loadMessages(DEFAULT_LOCALE);
  return fallbackMessages[key] ?? key;
}

export function getSupportedLocales() {
  return SUPPORTED_LOCALES.map((code) => ({
    code,
    ...localeMetadata[code],
  }));
}

export const i18n = {
  resolveLocale,
  loadMessages,
  getMessage,
  getSupportedLocales,
  supported: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
};
