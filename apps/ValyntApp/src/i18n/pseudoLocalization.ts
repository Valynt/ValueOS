import { PSEUDO_LOCALE_CODE, type PseudoLocaleCode } from "./config";

export type Messages = Record<string, string>;

const TOKEN_PATTERN = /(\{\{[^}]+\}\}|\{[^}]+\}|%\{[^}]+\}|%s|%d)/g;
const TOKEN_SEGMENT_PATTERN = /^(\{\{[^}]+\}\}|\{[^}]+\}|%\{[^}]+\}|%s|%d)$/;
const ACCENT_MAP: Record<string, string> = {
  a: "à",
  b: "ƀ",
  c: "ç",
  d: "đ",
  e: "ë",
  f: "ƒ",
  g: "ğ",
  h: "ħ",
  i: "ï",
  j: "ĵ",
  k: "ķ",
  l: "ľ",
  m: "m",
  n: "ñ",
  o: "ô",
  p: "þ",
  q: "q",
  r: "ř",
  s: "ş",
  t: "ŧ",
  u: "ü",
  v: "ṽ",
  w: "ŵ",
  x: "ẋ",
  y: "ÿ",
  z: "ž",
  A: "Â",
  B: "ß",
  C: "Č",
  D: "Ď",
  E: "Ë",
  F: "Ƒ",
  G: "Ğ",
  H: "Ħ",
  I: "Ï",
  J: "Ĵ",
  K: "Ķ",
  L: "Ľ",
  M: "M",
  N: "Ń",
  O: "Ö",
  P: "Þ",
  Q: "Q",
  R: "Ř",
  S: "Š",
  T: "Ŧ",
  U: "Û",
  V: "Ṽ",
  W: "Ŵ",
  X: "Ẍ",
  Y: "Ŷ",
  Z: "Ž",
};

export function pseudoLocalizeString(input: string): string {
  const segments = input.split(TOKEN_PATTERN);

  return segments
    .map((segment) => {
      if (!segment) {
        return segment;
      }

      if (TOKEN_SEGMENT_PATTERN.test(segment)) {
        return segment;
      }

      const accented = [...segment].map((ch) => ACCENT_MAP[ch] ?? ch).join("");
      const padLength = Math.max(2, Math.ceil(accented.length * 0.35));
      return `${accented}${"~".repeat(padLength)}`;
    })
    .join("");
}

export function buildPseudoLocaleMessages(sourceMessages: Messages): Messages {
  return Object.fromEntries(
    Object.entries(sourceMessages).map(([key, value]) => [key, pseudoLocalizeString(value)])
  );
}

export function getPseudoLocaleCode(): PseudoLocaleCode {
  return PSEUDO_LOCALE_CODE;
}
