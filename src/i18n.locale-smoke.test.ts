/**
 * QA Smoke Test: RU / EN locale validation post-migration
 *
 * Owner:      QA/QC (Speaky / Саша)
 * Created:    2026-03-19
 * Target ref: Development branch (climpire/a1f6f7e8) — after ko/ja/zh removal
 *
 * Purpose
 * -------
 * Validates that after the locale-removal PR lands:
 *   1. RU and EN are the only first-class locales.
 *   2. pickLang / normalizeLanguage / localeFromLanguage work correctly for both.
 *   3. Previously supported locales (ko, ja, zh) fall back gracefully to EN.
 *   4. No console errors or "missing-key" warnings are emitted during translation.
 *   5. Browser-language detection honours RU, falls back to EN for removed codes.
 *   6. Language preference persists to/from localStorage correctly.
 *   7. I18nProvider sets language context; useI18n override is applied correctly.
 */

import { createElement } from "react";
import { render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import {
  I18nProvider,
  LANGUAGE_STORAGE_KEY,
  detectBrowserLanguage,
  type I18nContextValue,
  localeFromLanguage,
  localeName,
  normalizeLanguage,
  pickLang,
  useI18n,
} from "./i18n";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGINAL_LANGUAGE = window.navigator.language;
const ORIGINAL_LANGUAGES = window.navigator.languages;

function setNavigatorLanguages(primary: string, fallbacks: string[] = []) {
  Object.defineProperty(window.navigator, "languages", {
    configurable: true,
    value: [primary, ...fallbacks],
  });
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: primary,
  });
}

// ---------------------------------------------------------------------------
// Suite 1 — normalizeLanguage: RU / EN recognition and removed-locale fallback
// ---------------------------------------------------------------------------

describe("[SMOKE] normalizeLanguage — RU/EN are supported, removed locales fall back to EN", () => {
  it("recognises 'ru' and regional variants", () => {
    expect(normalizeLanguage("ru")).toBe("ru");
    expect(normalizeLanguage("ru-RU")).toBe("ru");
    expect(normalizeLanguage("ru_RU")).toBe("ru");
    expect(normalizeLanguage("RU-RU")).toBe("ru"); // case-insensitive
  });

  it("recognises 'en' and regional variants", () => {
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("en-GB")).toBe("en");
    expect(normalizeLanguage("en_US")).toBe("en");
  });

  it("removed locales (ko, ja, zh) fall back to EN — no crash, no missing key", () => {
    // These locales were removed; the system must degrade gracefully
    expect(normalizeLanguage("ko")).toBe("en");
    expect(normalizeLanguage("ko-KR")).toBe("en");
    expect(normalizeLanguage("ja")).toBe("en");
    expect(normalizeLanguage("ja-JP")).toBe("en");
    expect(normalizeLanguage("zh")).toBe("en");
    expect(normalizeLanguage("zh-CN")).toBe("en");
    expect(normalizeLanguage("zh-TW")).toBe("en");
  });

  it("completely unknown locales fall back to EN", () => {
    expect(normalizeLanguage("fr-FR")).toBe("en");
    expect(normalizeLanguage("de")).toBe("en");
    expect(normalizeLanguage("")).toBe("en");
    expect(normalizeLanguage(null)).toBe("en");
    expect(normalizeLanguage(undefined)).toBe("en");
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — localeFromLanguage: IETF locale strings
// ---------------------------------------------------------------------------

describe("[SMOKE] localeFromLanguage — returns correct IETF locale strings", () => {
  it("RU → ru-RU", () => {
    expect(localeFromLanguage("ru")).toBe("ru-RU");
  });

  it("EN → en-US", () => {
    expect(localeFromLanguage("en")).toBe("en-US");
  });

  it("unknown value falls back to en-US (runtime edge case)", () => {
    // Type-cast simulates a runtime value slipping through validation
    expect(localeFromLanguage("ko" as Parameters<typeof localeFromLanguage>[0])).toBe("en-US");
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — pickLang: correct text selection, no missing-key scenario
// ---------------------------------------------------------------------------

describe("[SMOKE] pickLang — returns correct text, no missing-key warnings", () => {
  let consoleSpy: MockInstance;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("returns Russian text for 'ru' locale", () => {
    const result = pickLang("ru", { ru: "Привет мир", en: "Hello world" });
    expect(result).toBe("Привет мир");
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("returns English text for 'en' locale", () => {
    const result = pickLang("en", { ru: "Привет мир", en: "Hello world" });
    expect(result).toBe("Hello world");
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("all keys produce non-empty strings for every supported locale", () => {
    const text = { ru: "Тест", en: "Test" };
    const languages = ["ru", "en"] as const;
    for (const lang of languages) {
      const value = pickLang(lang, text);
      expect(value, `pickLang("${lang}") must return a non-empty string`).toBeTruthy();
      expect(typeof value).toBe("string");
    }
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("unknown runtime locale falls back to EN text without warning", () => {
    // Simulates a user whose stored locale is an old removed code
    const result = pickLang("ko" as Parameters<typeof pickLang>[0], { ru: "Привет", en: "Hello" });
    expect(result).toBe("Hello");
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — localeName: entity name localisation
// ---------------------------------------------------------------------------

describe("[SMOKE] localeName — entity names resolve for RU/EN", () => {
  it("returns Russian name when locale is 'ru' and name_ru is provided", () => {
    expect(localeName("ru", { name: "Planning", name_ru: "Планирование" })).toBe("Планирование");
  });

  it("falls back to English name when locale is 'en'", () => {
    expect(localeName("en", { name: "Planning", name_ru: "Планирование" })).toBe("Planning");
  });

  it("falls back to English name when name_ru is empty", () => {
    expect(localeName("ru", { name: "Planning", name_ru: "" })).toBe("Planning");
    expect(localeName("ru", { name: "Planning", name_ru: null })).toBe("Planning");
  });

  it("falls back to English name for removed locales (ko, ja, zh)", () => {
    expect(localeName("ko", { name: "Planning", name_ru: "Планирование" })).toBe("Planning");
    expect(localeName("ja", { name: "Planning", name_ru: "Планирование" })).toBe("Planning");
    expect(localeName("zh", { name: "Planning", name_ru: "Планирование" })).toBe("Planning");
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — detectBrowserLanguage: browser locale detection
// ---------------------------------------------------------------------------

describe("[SMOKE] detectBrowserLanguage — honours RU, falls back for removed locales", () => {
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

  it("detects Russian browser locale as 'ru'", () => {
    setNavigatorLanguages("ru-RU");
    expect(detectBrowserLanguage()).toBe("ru");
  });

  it("detects English browser locale as 'en'", () => {
    setNavigatorLanguages("en-US");
    expect(detectBrowserLanguage()).toBe("en");
  });

  it("RU is first in list — picks RU even if EN follows", () => {
    setNavigatorLanguages("ru-RU", ["en-US"]);
    expect(detectBrowserLanguage()).toBe("ru");
  });

  it("EN is first in list — picks EN even if RU follows", () => {
    setNavigatorLanguages("en-US", ["ru-RU"]);
    expect(detectBrowserLanguage()).toBe("en");
  });

  it("removed locale ko falls back to EN when no RU/EN alternative exists", () => {
    setNavigatorLanguages("ko-KR");
    expect(detectBrowserLanguage()).toBe("en");
  });

  it("removed locale ja falls back to EN", () => {
    setNavigatorLanguages("ja-JP");
    expect(detectBrowserLanguage()).toBe("en");
  });

  it("removed locale zh falls back to EN", () => {
    setNavigatorLanguages("zh-CN");
    expect(detectBrowserLanguage()).toBe("en");
  });

  it("list with removed locales followed by RU — correctly returns RU", () => {
    setNavigatorLanguages("ko-KR", ["ja-JP", "ru-RU"]);
    expect(detectBrowserLanguage()).toBe("ru");
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — localStorage persistence
// ---------------------------------------------------------------------------

describe("[SMOKE] Language preference persistence via localStorage", () => {
  afterEach(() => {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  });

  it("normalizeLanguage reads 'ru' correctly from a stored value", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "ru");
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    expect(normalizeLanguage(stored)).toBe("ru");
  });

  it("normalizeLanguage reads 'en' correctly from a stored value", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    expect(normalizeLanguage(stored)).toBe("en");
  });

  it("stale ko/ja/zh stored value falls back to EN without crash", () => {
    for (const stale of ["ko", "ja", "zh"]) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, stale);
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      expect(normalizeLanguage(stored), `stale "${stale}" must fall back to "en"`).toBe("en");
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — I18nProvider + useI18n: React context integration
// ---------------------------------------------------------------------------

describe("[SMOKE] I18nProvider + useI18n — no console errors on render", () => {
  let errorSpy: MockInstance;
  let warnSpy: MockInstance;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("renders with RU locale without console errors", () => {
    let captured: I18nContextValue | null = null;
    const Probe = () => {
      captured = useI18n();
      return null;
    };
    render(createElement(I18nProvider, { language: "ru" }, createElement(Probe)));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(captured).not.toBeNull();
    expect(captured!.language).toBe("ru");
    expect(captured!.locale).toBe("ru-RU");
  });

  it("renders with EN locale without console errors", () => {
    let captured: I18nContextValue | null = null;
    const Probe = () => {
      captured = useI18n();
      return null;
    };
    render(createElement(I18nProvider, { language: "en" }, createElement(Probe)));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(captured!.language).toBe("en");
    expect(captured!.locale).toBe("en-US");
  });

  it("t() returns Russian string without errors under RU provider", () => {
    let result = "";
    const Probe = () => {
      const { t } = useI18n();
      result = t({ ru: "Виртуальный офис", en: "Virtual office" });
      return null;
    };
    render(createElement(I18nProvider, { language: "ru" }, createElement(Probe)));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(result).toBe("Виртуальный офис");
  });

  it("t() returns English string without errors under EN provider", () => {
    let result = "";
    const Probe = () => {
      const { t } = useI18n();
      result = t({ ru: "Виртуальный офис", en: "Virtual office" });
      return null;
    };
    render(createElement(I18nProvider, { language: "en" }, createElement(Probe)));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(result).toBe("Virtual office");
  });

  it("t() handles plain string input without errors", () => {
    let result = "";
    const Probe = () => {
      const { t } = useI18n();
      result = t("plain string");
      return null;
    };
    render(createElement(I18nProvider, { language: "ru" }, createElement(Probe)));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(result).toBe("plain string");
  });

  it("useI18n override to 'ru' works even when Provider is 'en'", () => {
    let captured: I18nContextValue | null = null;
    const Probe = () => {
      captured = useI18n("ru-RU");
      return null;
    };
    render(createElement(I18nProvider, { language: "en" }, createElement(Probe)));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(captured!.language).toBe("ru");
    expect(captured!.locale).toBe("ru-RU");
    expect(captured!.t({ ru: "Привет", en: "Hi" })).toBe("Привет");
  });

  it("useI18n override to 'en' works even when Provider is 'ru'", () => {
    let captured: I18nContextValue | null = null;
    const Probe = () => {
      captured = useI18n("en-US");
      return null;
    };
    render(createElement(I18nProvider, { language: "ru" }, createElement(Probe)));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(captured!.language).toBe("en");
    expect(captured!.locale).toBe("en-US");
    expect(captured!.t({ ru: "Привет", en: "Hi" })).toBe("Hi");
  });

  it("removed locale in Provider gracefully falls back to EN without error", () => {
    let captured: I18nContextValue | null = null;
    const Probe = () => {
      captured = useI18n();
      return null;
    };
    // Provider receives a stale 'ko' value (e.g. from an old database record)
    render(createElement(I18nProvider, { language: "ko" }, createElement(Probe)));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(captured!.language).toBe("en");
    expect(captured!.locale).toBe("en-US");
  });
});
