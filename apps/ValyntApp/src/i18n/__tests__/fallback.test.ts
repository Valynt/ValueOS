import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, localeMetadata, SUPPORTED_LOCALES } from "../config";
import { getMessage, loadMessages, resolveLocale } from "../index";

describe("i18n locale fallback behavior", () => {
  it("resolves unsupported locales to the default locale", () => {
    expect(resolveLocale("fr")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("pt-BR")).toBe(DEFAULT_LOCALE);
  });

  it("resolves region variants to supported base locales", () => {
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("es-MX")).toBe("es");
  });

  it("falls back to default locale message when a key is missing", async () => {
    const translated = await getMessage("navigation.dashboard", "es");
    const fallback = await getMessage("nonexistent.translation.key", "es");

    expect(translated).toBe("Panel");
    expect(fallback).toBe("nonexistent.translation.key");
  });

  it("loads locale bundles for every configured locale", async () => {
    const bundles = await Promise.all(SUPPORTED_LOCALES.map((locale) => loadMessages(locale)));

    for (const [index, messages] of bundles.entries()) {
      expect(Object.keys(messages).length).toBeGreaterThan(0);
      expect(localeMetadata[SUPPORTED_LOCALES[index]]).toBeDefined();
    }
  });
});
