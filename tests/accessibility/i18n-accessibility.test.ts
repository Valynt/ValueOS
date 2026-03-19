/**
 * Internationalization Accessibility Tests
 *
 * Production contract:
 * - Shipped locales: `en` and `es`
 * - Text direction: LTR only in production today
 * - Pseudo-localization exists only as a QA helper and is not a shipped locale
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  NON_PRODUCTION_LOCALES,
  PSEUDO_LOCALE_CODE,
  SUPPORTED_LOCALES,
  localeMetadata,
} from "../../apps/ValyntApp/src/i18n/config";
import enMessages from "../../apps/ValyntApp/src/i18n/locales/en/common.json";
import esMessages from "../../apps/ValyntApp/src/i18n/locales/es/common.json";
import { buildPseudoLocaleMessages } from "../../apps/ValyntApp/src/i18n/pseudoLocalization";

describe("Internationalization Accessibility Tests", () => {
  describe("Language declaration contract", () => {
    it("declares page language correctly for each shipped locale", () => {
      expect(SUPPORTED_LOCALES).toEqual(["en", "es"]);

      for (const locale of SUPPORTED_LOCALES) {
        expect(localeMetadata[locale].label).toBeTruthy();
        expect(localeMetadata[locale].direction).toBe("ltr");
        expect(localeMetadata[locale].productionReady).toBe(true);
      }
    });

    it("keeps non-production pseudo-localization out of the shipped locale list", () => {
      expect(NON_PRODUCTION_LOCALES).toContain(PSEUDO_LOCALE_CODE);
      expect(SUPPORTED_LOCALES).not.toContain(PSEUDO_LOCALE_CODE);
      expect(DEFAULT_LOCALE).toBe("en");
    });
  });

  describe("Accessibility strings in shipped locales", () => {
    it("keeps core navigation, auth, and form strings available in English and Spanish", () => {
      const requiredKeys = [
        "navigation.home",
        "navigation.dashboard",
        "form.save",
        "form.cancel",
        "errors.generic",
        "errors.network",
        "auth.language",
        "auth.email",
        "auth.password",
        "auth.signIn",
      ] as const;

      for (const key of requiredKeys) {
        expect(enMessages[key]).toBeTruthy();
        expect(esMessages[key]).toBeTruthy();
      }
    });

    it("preserves translation coverage parity for the current shipped locale set", () => {
      const enKeys = Object.keys(enMessages).sort();
      const esKeys = Object.keys(esMessages).sort();

      expect(esKeys).toEqual(enKeys);
    });

    it("provides distinct translated text where the locale should differ", () => {
      expect(enMessages["navigation.dashboard"]).toBe("Dashboard");
      expect(esMessages["navigation.dashboard"]).toBe("Panel");
      expect(enMessages["auth.signIn"]).toBe("Sign in");
      expect(esMessages["auth.signIn"]).toBe("Iniciar sesión");
    });
  });

  describe("Pseudo-localization QA path", () => {
    it("can generate expanded pseudo-localized strings for accessibility overflow checks", () => {
      const pseudoMessages = buildPseudoLocaleMessages(enMessages);

      expect(pseudoMessages["auth.signIn"]).toContain("~");
      expect(pseudoMessages["auth.signIn"].length).toBeGreaterThan(
        enMessages["auth.signIn"].length
      );
      expect(pseudoMessages["auth.signIn"]).not.toContain(PSEUDO_LOCALE_CODE);
    });

    it("preserves interpolation tokens in pseudo-localized accessibility copy", () => {
      const pseudo = buildPseudoLocaleMessages({
        "aria.results": "{count} results found",
      });

      expect(pseudo["aria.results"]).toContain("{count}");
      expect(pseudo["aria.results"].length).toBeGreaterThan(
        "{count} results found".length
      );
    });
  });
});
