/* eslint-disable no-unused-vars */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { DEFAULT_LOCALE, type LocaleCode, localeMetadata } from "./config";

import { loadMessages, resolveLocale } from "./index";

type Messages = Record<string, string>;
const LOCALE_STORAGE_KEY = "valueos.locale";

type I18nContextValue = {
  locale: LocaleCode;
  direction: "ltr" | "rtl";
  setLocale: (nextLocale: LocaleCode) => Promise<void>;
  t: (translationKey: string, fallbackText?: string) => string;
  loading: boolean;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function getInitialLocale(): LocaleCode {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) {
    return resolveLocale(stored);
  }

  return resolveLocale(navigator.language);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(() => getInitialLocale());
  const [messages, setMessages] = useState<Messages>({});
  const [loading, setLoading] = useState(true);

  const setLocale = useCallback(async (nextLocale: LocaleCode) => {
    const resolved = resolveLocale(nextLocale);
    setLoading(true);
    const loadedMessages = await loadMessages(resolved);
    setLocaleState(resolved);
    setMessages(loadedMessages);
    localStorage.setItem(LOCALE_STORAGE_KEY, resolved);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    loadMessages(locale)
      .then((loadedMessages) => {
        if (!active) return;
        setMessages(loadedMessages);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeMetadata[locale].direction;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction: localeMetadata[locale].direction,
      setLocale,
      t: (translationKey, fallbackText) => messages[translationKey] ?? fallbackText ?? translationKey,
      loading,
    }),
    [locale, loading, messages, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return context;
}
