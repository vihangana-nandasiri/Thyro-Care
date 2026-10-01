import { describe, expect, test } from "bun:test";
import { dictionaries, isLang, languageOptions } from "./config";

describe("i18n configuration", () => {
  test("every supported language has the same translation keys", () => {
    const englishKeys = Object.keys(dictionaries.en).sort();

    expect(Object.keys(dictionaries.si).sort()).toEqual(englishKeys);
    expect(Object.keys(dictionaries.ta).sort()).toEqual(englishKeys);
  });

  test("Tamil is a selectable and valid language", () => {
    expect(isLang("ta")).toBe(true);
    expect(languageOptions.some((option) => option.value === "ta")).toBe(true);
  });

  test("unknown cookie values are rejected", () => {
    expect(isLang("unknown")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});
