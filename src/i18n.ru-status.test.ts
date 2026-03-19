/**
 * QA Characterization Test: Russian (ru) locale support status
 *
 * Owner: QA/QC (DORO)
 * Date:  2026-03-19
 * Scope: Documents the CURRENT state — Russian is NOT yet supported.
 *        These tests will need to be updated once "ru" is added to UiLanguage.
 */
import { describe, expect, it } from "vitest";
import {
  localeFromLanguage,
  normalizeLanguage,
  pickLang,
  type LangText,
  type UiLanguage,
} from "./i18n";

describe("[QA] Russian locale support — current status: NOT IMPLEMENTED", () => {
  it("normalizeLanguage falls back to 'en' for 'ru' input", () => {
    // "ru" is not in UiLanguage union; normalizeLanguage returns "en" as default
    expect(normalizeLanguage("ru")).toBe("en");
    expect(normalizeLanguage("ru-RU")).toBe("en");
    expect(normalizeLanguage("ru_RU")).toBe("en");
  });

  it("localeFromLanguage returns 'en-US' for unsupported 'ru' (runtime cast)", () => {
    // Type-cast simulates a future runtime path where "ru" might be stored
    // in localStorage before the type was expanded. Should return fallback.
    expect(localeFromLanguage("ru" as UiLanguage)).toBe("en-US");
  });

  it("pickLang falls back to English for unsupported 'ru' locale", () => {
    const text: LangText = { ko: "안녕", en: "hello", ja: "こんにちは", zh: "你好" };
    // No "ru" key in LangText; runtime default branch returns English
    expect(pickLang("ru" as UiLanguage, text)).toBe("hello");
  });

  it("all supported languages are ko/en/ja/zh — 'ru' is absent", () => {
    // Enumerate the current supported set to make the gap explicit
    const supportedLocales = ["ko-KR", "en-US", "ja-JP", "zh-CN"];
    const ruLocale = localeFromLanguage("ru" as UiLanguage);
    expect(supportedLocales).not.toContain("ru-RU");
    expect(supportedLocales).toContain(ruLocale); // fallback is still valid
  });
});
