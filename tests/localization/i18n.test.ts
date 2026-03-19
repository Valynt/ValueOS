/**
 * Internationalization (i18n) Tests
 *
 * Current product contract:
 * - Production locales: `en` and `es`
 * - Region variants resolve to their supported base locale
 * - Unsupported locales fall back to `en`
 * - Pseudo-localization is a QA tool, not a shipped locale
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  NON_PRODUCTION_LOCALES,
  PSEUDO_LOCALE_CODE,
  SUPPORTED_LOCALES,
} from "../../apps/ValyntApp/src/i18n/config";
import enMessages from "../../apps/ValyntApp/src/i18n/locales/en/common.json";
import esMessages from "../../apps/ValyntApp/src/i18n/locales/es/common.json";
import {
  getMessage,
  getSupportedLocales,
  loadMessages,
  resolveLocale,
} from "../../apps/ValyntApp/src/i18n";
import { buildPseudoLocaleMessages } from "../../apps/ValyntApp/src/i18n/pseudoLocalization";

describe("Internationalization Tests", () => {
  describe("Supported locale contract", () => {
    it("ships exactly English and Spanish in production", () => {
      expect(SUPPORTED_LOCALES).toEqual(["en", "es"]);
      expect(getSupportedLocales()).toEqual([
        { code: "en", label: "English", direction: "ltr", productionReady: true },
        { code: "es", label: "Español", direction: "ltr", productionReady: true },
      ]);
    });

    it("tracks pseudo-localization separately from shipped locales", () => {
      expect(NON_PRODUCTION_LOCALES).toEqual([PSEUDO_LOCALE_CODE]);
      expect(SUPPORTED_LOCALES).not.toContain(PSEUDO_LOCALE_CODE);
    });
  });

  describe("Locale resolution", () => {
    it("resolves region variants to the supported base locale", () => {
      expect(resolveLocale("en-US")).toBe("en");
      expect(resolveLocale("es-MX")).toBe("es");
    });

    it("falls back unsupported locales to English", () => {
      expect(resolveLocale("fr-FR")).toBe(DEFAULT_LOCALE);
      expect(resolveLocale("ar")).toBe(DEFAULT_LOCALE);
      expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    });
  });

  describe("Translation loading and fallback", () => {
    it("loads the configured locale bundles", async () => {
      const [enBundle, esBundle] = await Promise.all([
        loadMessages("en"),
        loadMessages("es"),
      ]);

      expect(enBundle).toMatchObject(enMessages);
      expect(esBundle).toMatchObject(esMessages);
    });

    it("falls back to the key when a translation is missing", async () => {
      await expect(getMessage("navigation.dashboard", "es")).resolves.toBe("Panel");
      await expect(getMessage("missing.translation.key", "es")).resolves.toBe(
        "missing.translation.key"
      );
    });

    it("keeps English and Spanish catalogs in parity for the shipped product", () => {
      expect(Object.keys(esMessages).sort()).toEqual(Object.keys(enMessages).sort());
    });
  });

  describe("Formatting coverage for shipped locales", () => {
    it("supports locale-aware dates for English and Spanish", () => {
      const date = new Date("2026-01-04T12:00:00Z");
      const english = new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).format(date);
      const spanish = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC" }).format(date);

      expect(english).toBeTruthy();
      expect(spanish).toBeTruthy();
      expect(english).not.toBe(spanish);
    });

    it("supports locale-aware numbers for English and Spanish", () => {
      const value = 1234567.89;
      const english = new Intl.NumberFormat("en-US").format(value);
      const spanish = new Intl.NumberFormat("es-ES").format(value);

      expect(english).toBe("1,234,567.89");
      expect(spanish).toBe("1.234.567,89");
    });

    it("supports locale-aware currency formatting for English and Spanish", () => {
      const amount = 1234.56;
      const english = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
      const spanish = new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
      }).format(amount);

      expect(english).toContain("$");
      expect(spanish).toContain("€");
    });
  });

  describe("Pseudo-localization QA path", () => {
    it("can build pseudo-localized copies of the source catalog without changing keys", () => {
      const pseudoMessages = buildPseudoLocaleMessages(enMessages);

      expect(Object.keys(pseudoMessages)).toEqual(Object.keys(enMessages));
      expect(pseudoMessages["auth.welcomeBack"]).not.toBe(enMessages["auth.welcomeBack"]);
      expect(pseudoMessages["auth.welcomeBack"].length).toBeGreaterThan(
        enMessages["auth.welcomeBack"].length
      );
    });
  });
});
