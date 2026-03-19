import { describe, expect, it } from "vitest";

import { PSEUDO_LOCALE_CODE } from "../config";
import {
  buildPseudoLocaleMessages,
  getPseudoLocaleCode,
  pseudoLocalizeString,
} from "../pseudoLocalization";

describe("pseudo-localization helpers", () => {
  it("keeps interpolation tokens intact while expanding visible text", () => {
    const source = "Hello {name}, you have {{count}} messages";
    const pseudo = pseudoLocalizeString(source);

    expect(pseudo).toContain("{name}");
    expect(pseudo).toContain("{{count}}");
    expect(pseudo.length).toBeGreaterThan(source.length);
  });

  it("builds pseudo-localized message dictionaries from source messages", () => {
    const sourceMessages = {
      "auth.signIn": "Sign in",
      "errors.network": "Try again later",
    };

    const pseudoMessages = buildPseudoLocaleMessages(sourceMessages);

    expect(Object.keys(pseudoMessages)).toEqual(Object.keys(sourceMessages));
    expect(pseudoMessages["auth.signIn"]).not.toBe(sourceMessages["auth.signIn"]);
    expect(pseudoMessages["errors.network"].length).toBeGreaterThan(
      sourceMessages["errors.network"].length
    );
  });

  it("exposes a stable pseudo-locale code for QA-only workflows", () => {
    expect(getPseudoLocaleCode()).toBe(PSEUDO_LOCALE_CODE);
    expect(PSEUDO_LOCALE_CODE).toBe("en-XA");
  });
});
