import { createElement } from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  I18nProvider,
  detectBrowserLanguage,
  type I18nContextValue,
  localeFromLanguage,
  localeName,
  normalizeLanguage,
  pickLang,
  useI18n,
  type LangText,
  type UiLanguage,
} from "./i18n";

const ORIGINAL_LANGUAGE = window.navigator.language;
const ORIGINAL_LANGUAGES = window.navigator.languages;

describe("i18n helpers", () => {
  afterEach(() => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: ORIGINAL_LANGUAGE,
    });
    Object.defineProperty(window.navigator, "languages", {
      configurable: true,
      value: ORIGINAL_LANGUAGES,
    });
  });

  it("normalizeLanguage  locale", () => {
    expect(normalizeLanguage("ko-KR")).toBe("ko");
    expect(normalizeLanguage("en_US")).toBe("en");
    expect(normalizeLanguage("ja-JP")).toBe("ja");
    expect(normalizeLanguage("zh-CN")).toBe("zh");
    expect(normalizeLanguage("fr-FR")).toBe("en");
    expect(normalizeLanguage(undefined)).toBe("en");
  });

  it("detectBrowserLanguage navigator.languages", () => {
    Object.defineProperty(window.navigator, "languages", {
      configurable: true,
      value: ["ja-JP", "en-US"],
    });
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "ko-KR",
    });
    expect(detectBrowserLanguage()).toBe("ja");
  });

  it("localeName/pickLang/localeFromLanguage fallback", () => {
    const text: LangText = {
      ko: "",
      en: "hello",
    };
    expect(pickLang("ko", text)).toBe("");
    expect(pickLang("ja", text)).toBe("hello");
    expect(pickLang("zh", text)).toBe("hello");

    expect(
      localeName("ko", {
        name: "Planning",
        name_ko: "",
      }),
    ).toBe("");
    expect(
      localeName("ja", {
        name: "Planning",
        name_ja: "",
      }),
    ).toBe("Planning");

    expect(localeFromLanguage("ko")).toBe("ko-KR");
    expect(localeFromLanguage("en")).toBe("en-US");
    expect(localeFromLanguage("ja")).toBe("ja-JP");
    expect(localeFromLanguage("zh")).toBe("zh-CN");
  });

  // QA characterization: Russian locale is NOT yet supported (2026-03-19)
  // This test documents the current state. When "ru" is added to UiLanguage,
  // update this suite to cover Russian translation coverage.
  it("[QA] Russian (ru) is not in UiLanguage — normalizeLanguage falls back to en", () => {
    // "ru" is not a valid UiLanguage value; any ru-* locale normalizes to "en"
    expect(normalizeLanguage("ru")).toBe("en");
    expect(normalizeLanguage("ru-RU")).toBe("en");
  });

  it("[QA] localeFromLanguage has no Russian case — unsupported input returns en-US", () => {
    // Type-cast to bypass compile-time check, simulating a runtime edge case
    expect(localeFromLanguage("ru" as UiLanguage)).toBe("en-US");
  });

  it("[QA] pickLang has no Russian case — falls back to en for unsupported locales", () => {
    const text: LangText = { ko: "", en: "hello", ja: "こんにちは", zh: "你好" };
    // "ru" is not a valid UiLanguage; runtime would fall through to default (en)
    expect(pickLang("ru" as UiLanguage, text)).toBe("hello");
  });

  it("[QA] detectBrowserLanguage ignores ru-RU and falls back to next candidate", () => {
    Object.defineProperty(window.navigator, "languages", {
      configurable: true,
      value: ["ru-RU", "en-US"],
    });
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "ru-RU",
    });
    // ru-RU is not recognised; falls through to en-US
    expect(detectBrowserLanguage()).toBe("en");
  });

  it("useI18n override   Provider  override", () => {
    let result: I18nContextValue = {
      language: "en",
      locale: "en-US",
      t: (text) => (typeof text === "string" ? text : text.en),
    };
    const Probe = ({ override }: { override?: string }) => {
      result = useI18n(override);
      return null;
    };

    const { rerender } = render(
      createElement(I18nProvider, {
        language: "ko",
        children: createElement(Probe, { override: "ja-JP" }),
      }),
    );

    expect(result.language).toBe("ja");
    expect(result.locale).toBe("ja-JP");
    expect(
      result.t({
        ko: "",
        en: "hello",
        ja: "こんにちは",
        zh: "你好",
      }),
    ).toBe("こんにちは");

    rerender(
      createElement(I18nProvider, {
        language: "ko",
        children: createElement(Probe, { override: undefined }),
      }),
    );

    expect(result.language).toBe("ko");
    expect(result.locale).toBe("ko-KR");
    expect(
      result.t({
        ko: "",
        en: "hello",
        ja: "こんにちは",
        zh: "你好",
      }),
    ).toBe("");
  });
});
