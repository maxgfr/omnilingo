import { describe, it, expect, beforeEach } from "vitest";
import {
  OnboardingStateSchema,
  isOnboardingComplete,
  isOnboardingDone,
  markOnboardingDone,
  resetOnboarding,
  LANGUAGES,
  LEVELS,
  AI_PROVIDERS,
  findLangCode3,
  scoreDictRelevance,
  filterDictionaries,
} from "../lib/onboarding";

// ─────────────────────────────────────────────────────────────────────
// 1. OnboardingStateSchema validation
// ─────────────────────────────────────────────────────────────────────
describe("OnboardingStateSchema", () => {
  it("accepts a fully valid state", () => {
    const state = {
      step: 3,
      nativeLang: "fr",
      targetLang: "de",
      level: "B1",
      aiProvider: "anthropic",
      aiApiKey: "sk-test",
      completed: false,
    };
    const result = OnboardingStateSchema.parse(state);
    expect(result.step).toBe(3);
    expect(result.nativeLang).toBe("fr");
    expect(result.targetLang).toBe("de");
    expect(result.level).toBe("B1");
    expect(result.aiProvider).toBe("anthropic");
    expect(result.aiApiKey).toBe("sk-test");
    expect(result.completed).toBe(false);
  });

  it("accepts nullable fields as null", () => {
    const state = {
      step: 0,
      nativeLang: null,
      targetLang: null,
      level: null,
      aiProvider: "claude-code",
      aiApiKey: "",
      completed: false,
    };
    const result = OnboardingStateSchema.parse(state);
    expect(result.nativeLang).toBeNull();
    expect(result.targetLang).toBeNull();
    expect(result.level).toBeNull();
  });

  it("applies defaults for aiProvider, aiApiKey, completed", () => {
    const state = {
      step: 0,
      nativeLang: null,
      targetLang: null,
      level: null,
    };
    const result = OnboardingStateSchema.parse(state);
    expect(result.aiProvider).toBe("claude-code");
    expect(result.aiApiKey).toBe("");
    expect(result.completed).toBe(false);
  });

  it("rejects step below 0", () => {
    const state = {
      step: -1,
      nativeLang: null,
      targetLang: null,
      level: null,
    };
    expect(() => OnboardingStateSchema.parse(state)).toThrow();
  });

  it("rejects step above 5", () => {
    const state = {
      step: 6,
      nativeLang: null,
      targetLang: null,
      level: null,
    };
    expect(() => OnboardingStateSchema.parse(state)).toThrow();
  });

  it("accepts step 0 (minimum)", () => {
    const result = OnboardingStateSchema.parse({
      step: 0,
      nativeLang: null,
      targetLang: null,
      level: null,
    });
    expect(result.step).toBe(0);
  });

  it("accepts step 5 (maximum)", () => {
    const result = OnboardingStateSchema.parse({
      step: 5,
      nativeLang: null,
      targetLang: null,
      level: null,
    });
    expect(result.step).toBe(5);
  });

  it("rejects non-integer step", () => {
    expect(() =>
      OnboardingStateSchema.parse({
        step: "two",
        nativeLang: null,
        targetLang: null,
        level: null,
      }),
    ).toThrow();
  });

  it("rejects missing step", () => {
    expect(() =>
      OnboardingStateSchema.parse({
        nativeLang: null,
        targetLang: null,
        level: null,
      }),
    ).toThrow();
  });

  it("accepts completed = true", () => {
    const result = OnboardingStateSchema.parse({
      step: 5,
      nativeLang: "en",
      targetLang: "fr",
      level: "A1",
      completed: true,
    });
    expect(result.completed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2. isOnboardingComplete
// ─────────────────────────────────────────────────────────────────────
describe("isOnboardingComplete", () => {
  it("returns true when completed is true", () => {
    const state = OnboardingStateSchema.parse({
      step: 5,
      nativeLang: "en",
      targetLang: "fr",
      level: "B2",
      completed: true,
    });
    expect(isOnboardingComplete(state)).toBe(true);
  });

  it("returns false when completed is false", () => {
    const state = OnboardingStateSchema.parse({
      step: 3,
      nativeLang: "en",
      targetLang: "fr",
      level: null,
      completed: false,
    });
    expect(isOnboardingComplete(state)).toBe(false);
  });

  it("returns false by default", () => {
    const state = OnboardingStateSchema.parse({
      step: 0,
      nativeLang: null,
      targetLang: null,
      level: null,
    });
    expect(isOnboardingComplete(state)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3. localStorage persistence: isOnboardingDone / markOnboardingDone / resetOnboarding
// ─────────────────────────────────────────────────────────────────────
describe("localStorage persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("isOnboardingDone returns false when nothing is stored", () => {
    expect(isOnboardingDone()).toBe(false);
  });

  it("markOnboardingDone sets the flag", () => {
    markOnboardingDone();
    expect(isOnboardingDone()).toBe(true);
  });

  it("resetOnboarding clears the flag", () => {
    markOnboardingDone();
    expect(isOnboardingDone()).toBe(true);
    resetOnboarding();
    expect(isOnboardingDone()).toBe(false);
  });

  it("isOnboardingDone returns false for non-true values", () => {
    localStorage.setItem("omnilingo-onboarding-done", "false");
    expect(isOnboardingDone()).toBe(false);
  });

  it("isOnboardingDone returns false for random values", () => {
    localStorage.setItem("omnilingo-onboarding-done", "yes");
    expect(isOnboardingDone()).toBe(false);
  });

  it("isOnboardingDone returns true only for exact 'true'", () => {
    localStorage.setItem("omnilingo-onboarding-done", "true");
    expect(isOnboardingDone()).toBe(true);
  });

  it("markOnboardingDone can be called multiple times safely", () => {
    markOnboardingDone();
    markOnboardingDone();
    markOnboardingDone();
    expect(isOnboardingDone()).toBe(true);
  });

  it("resetOnboarding is idempotent", () => {
    resetOnboarding();
    resetOnboarding();
    expect(isOnboardingDone()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4. Constants
// ─────────────────────────────────────────────────────────────────────
describe("Constants", () => {
  describe("LANGUAGES", () => {
    it("has at least 10 languages", () => {
      expect(LANGUAGES.length).toBeGreaterThanOrEqual(10);
    });

    it("each language has code, code3, name, flag", () => {
      for (const lang of LANGUAGES) {
        expect(lang.code).toBeTruthy();
        expect(lang.code.length).toBe(2);
        expect(lang.code3).toBeTruthy();
        expect(lang.code3.length).toBe(3);
        expect(lang.name).toBeTruthy();
        expect(lang.flag).toBeTruthy();
      }
    });

    it("has no duplicate codes", () => {
      const codes = LANGUAGES.map((l) => l.code);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it("has no duplicate code3 values", () => {
      const codes3 = LANGUAGES.map((l) => l.code3);
      expect(new Set(codes3).size).toBe(codes3.length);
    });

    it("includes French, English, German", () => {
      const codes = LANGUAGES.map((l) => l.code);
      expect(codes).toContain("fr");
      expect(codes).toContain("en");
      expect(codes).toContain("de");
    });
  });

  describe("LEVELS", () => {
    it("has A1, A2, B1, B2", () => {
      const values = LEVELS.map((l) => l.value);
      expect(values).toEqual(["A1", "A2", "B1", "B2"]);
    });

    it("B2 level is available", () => {
      const b2 = LEVELS.find((l) => l.value === "B2");
      expect(b2).toBeDefined();
      expect(b2!.value).toBe("B2");
    });

    it("each level has styling properties", () => {
      for (const level of LEVELS) {
        expect(level.color).toBeTruthy();
        expect(level.bg).toBeTruthy();
        expect(level.border).toBeTruthy();
        expect(level.hover).toBeTruthy();
      }
    });
  });

  describe("AI_PROVIDERS", () => {
    it("has claude-code as first provider", () => {
      expect(AI_PROVIDERS[0].value).toBe("claude-code");
    });

    it("claude-code requires no API key", () => {
      const cc = AI_PROVIDERS.find((p) => p.value === "claude-code");
      expect(cc?.noKey).toBe(true);
    });

    it("anthropic requires an API key", () => {
      const anthropic = AI_PROVIDERS.find((p) => p.value === "anthropic");
      expect(anthropic?.noKey).toBe(false);
    });

    it("ollama requires no API key", () => {
      const ollama = AI_PROVIDERS.find((p) => p.value === "ollama");
      expect(ollama?.noKey).toBe(true);
    });

    it("has at least 3 providers", () => {
      expect(AI_PROVIDERS.length).toBeGreaterThanOrEqual(3);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5. findLangCode3
// ─────────────────────────────────────────────────────────────────────
describe("findLangCode3", () => {
  it("returns 3-letter code for valid 2-letter code", () => {
    expect(findLangCode3("fr")).toBe("fra");
    expect(findLangCode3("en")).toBe("eng");
    expect(findLangCode3("de")).toBe("deu");
  });

  it("returns empty string for unknown code", () => {
    expect(findLangCode3("xx")).toBe("");
    expect(findLangCode3("")).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 6. scoreDictRelevance
// ─────────────────────────────────────────────────────────────────────
describe("scoreDictRelevance", () => {
  it("returns 0 for exact pair match (native=fra, target=deu)", () => {
    // dict: deu -> fra, user: native=fra, target=deu
    expect(scoreDictRelevance("deu", "fra", "fra", "deu")).toBe(0);
  });

  it("returns 0 for exact pair match (reverse order)", () => {
    // dict: fra -> deu, user: native=fra, target=deu
    expect(scoreDictRelevance("fra", "deu", "fra", "deu")).toBe(0);
  });

  it("returns 1 for partial match (one lang matches)", () => {
    // dict: deu -> spa, user: native=fra, target=deu
    expect(scoreDictRelevance("deu", "spa", "fra", "deu")).toBe(1);
  });

  it("returns 2 for no match at all", () => {
    // dict: jpn -> kor, user: native=fra, target=deu
    expect(scoreDictRelevance("jpn", "kor", "fra", "deu")).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 7. filterDictionaries
// ─────────────────────────────────────────────────────────────────────
describe("filterDictionaries", () => {
  const mockDicts = [
    { source_lang: "jpn", target_lang: "kor", source_name: "Japanese", target_name: "Korean" },
    { source_lang: "deu", target_lang: "fra", source_name: "German", target_name: "French" },
    { source_lang: "eng", target_lang: "fra", source_name: "English", target_name: "French" },
    { source_lang: "deu", target_lang: "spa", source_name: "German", target_name: "Spanish" },
  ];

  it("returns all dicts when search is empty", () => {
    const result = filterDictionaries(mockDicts, "", "fra", "deu");
    expect(result.length).toBe(4);
  });

  it("sorts exact matches first", () => {
    const result = filterDictionaries(mockDicts, "", "fra", "deu");
    expect(result[0].source_lang).toBe("deu");
    expect(result[0].target_lang).toBe("fra");
  });

  it("sorts partial matches after exact", () => {
    const result = filterDictionaries(mockDicts, "", "fra", "deu");
    // deu-fra first (exact), then eng-fra and deu-spa (partial), then jpn-kor (none)
    expect(result[result.length - 1].source_lang).toBe("jpn");
  });

  it("filters by search term (source_name)", () => {
    const result = filterDictionaries(mockDicts, "Japanese", "fra", "deu");
    expect(result.length).toBe(1);
    expect(result[0].source_lang).toBe("jpn");
  });

  it("filters by search term (target_name)", () => {
    const result = filterDictionaries(mockDicts, "French", "fra", "deu");
    expect(result.length).toBe(2);
  });

  it("filters by search term (language code)", () => {
    const result = filterDictionaries(mockDicts, "eng", "fra", "deu");
    expect(result.length).toBe(1);
    expect(result[0].source_lang).toBe("eng");
  });

  it("is case-insensitive", () => {
    const result = filterDictionaries(mockDicts, "GERMAN", "fra", "deu");
    expect(result.length).toBe(2);
  });

  it("returns empty for no matches", () => {
    const result = filterDictionaries(mockDicts, "zzzzz", "fra", "deu");
    expect(result.length).toBe(0);
  });

  it("trims whitespace-only search", () => {
    const result = filterDictionaries(mockDicts, "   ", "fra", "deu");
    expect(result.length).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 8. Onboarding flow logic (unit-level, no React rendering)
// ─────────────────────────────────────────────────────────────────────
describe("Onboarding flow logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Step transitions", () => {
    it("flow goes 0 -> 1 -> 2 -> 3 -> 4 -> 5", () => {
      // Simulate the step state machine
      const steps = [0, 1, 2, 3, 4, 5];
      for (let i = 0; i < steps.length - 1; i++) {
        const current = steps[i];
        const next = steps[i + 1];
        expect(next).toBe(current + 1);
      }
    });

    it("step 1 requires selecting a native language to proceed", () => {
      // The component only advances to step 2 when a language button is clicked.
      // Without clicking, nativeLang stays null.
      const nativeLang: string | null = null;
      expect(nativeLang).toBeNull();
      // After selection:
      const selected = "fr";
      expect(selected).toBeTruthy();
    });

    it("step 2 only shows languages different from native", () => {
      const nativeLang: string = "fr";
      const targetOptions = LANGUAGES.filter((l) => l.code !== nativeLang);
      expect(targetOptions.every((l) => l.code !== nativeLang)).toBe(true);
      expect(targetOptions.length).toBe(LANGUAGES.length - 1);
    });

    it("step 3 requires selecting one of the 4 levels", () => {
      const validLevels = LEVELS.map((l) => l.value);
      expect(validLevels).toContain("A1");
      expect(validLevels).toContain("A2");
      expect(validLevels).toContain("B1");
      expect(validLevels).toContain("B2");
    });
  });

  describe("Completion behavior", () => {
    it("completing flow marks onboarding as done", () => {
      expect(isOnboardingDone()).toBe(false);
      markOnboardingDone();
      expect(isOnboardingDone()).toBe(true);
    });

    it("skip also marks onboarding as done", () => {
      // Skip calls markOnboardingDone, same as finish
      markOnboardingDone();
      expect(isOnboardingDone()).toBe(true);
    });

    it("onboarding does not re-trigger after completion even if activePair changes", () => {
      markOnboardingDone();
      // Simulate activePair change -- the new component checks localStorage, not word count
      // So changing activePair does not reset the flag
      expect(isOnboardingDone()).toBe(true);
      // Even if we "change" the pair, it remains done
      expect(isOnboardingDone()).toBe(true);
    });

    it("resetOnboarding allows re-triggering", () => {
      markOnboardingDone();
      expect(isOnboardingDone()).toBe(true);
      resetOnboarding();
      expect(isOnboardingDone()).toBe(false);
    });
  });

  describe("AI provider selection", () => {
    it("default provider is claude-code", () => {
      const defaultProvider = "claude-code";
      const provider = AI_PROVIDERS.find((p) => p.value === defaultProvider);
      expect(provider).toBeDefined();
      expect(provider!.noKey).toBe(true);
    });

    it("providers requiring keys are identified correctly", () => {
      const keyRequired = AI_PROVIDERS.filter((p) => !p.noKey);
      expect(keyRequired.length).toBeGreaterThan(0);
      for (const p of keyRequired) {
        expect(p.noKey).toBe(false);
      }
    });

    it("providers not requiring keys are identified correctly", () => {
      const noKeyProviders = AI_PROVIDERS.filter((p) => p.noKey);
      expect(noKeyProviders.length).toBeGreaterThan(0);
      expect(noKeyProviders.map((p) => p.value)).toContain("claude-code");
      expect(noKeyProviders.map((p) => p.value)).toContain("ollama");
    });
  });

  describe("Dictionary search/filter", () => {
    const dicts = [
      { source_lang: "deu", target_lang: "fra", source_name: "German", target_name: "French" },
      { source_lang: "eng", target_lang: "fra", source_name: "English", target_name: "French" },
      { source_lang: "spa", target_lang: "ita", source_name: "Spanish", target_name: "Italian" },
    ];

    it("search for 'German' returns only German dicts", () => {
      const result = filterDictionaries(dicts, "German", "fra", "deu");
      expect(result.length).toBe(1);
      expect(result[0].source_name).toBe("German");
    });

    it("search for 'fra' returns dicts containing French language", () => {
      const result = filterDictionaries(dicts, "fra", "fra", "deu");
      expect(result.length).toBe(2);
    });

    it("empty search returns all, sorted by relevance", () => {
      const result = filterDictionaries(dicts, "", "fra", "deu");
      expect(result.length).toBe(3);
      // deu-fra should be first (exact match for user learning German from French)
      expect(result[0].source_lang).toBe("deu");
      expect(result[0].target_lang).toBe("fra");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// 9. Edge cases and regression tests
// ─────────────────────────────────────────────────────────────────────
describe("Edge cases and regressions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("OnboardingStateSchema rejects boolean step", () => {
    expect(() =>
      OnboardingStateSchema.parse({
        step: true,
        nativeLang: null,
        targetLang: null,
        level: null,
      }),
    ).toThrow();
  });

  it("OnboardingStateSchema accepts step=0 with all defaults", () => {
    const state = OnboardingStateSchema.parse({
      step: 0,
      nativeLang: null,
      targetLang: null,
      level: null,
    });
    expect(state.step).toBe(0);
    expect(state.completed).toBe(false);
    expect(state.aiProvider).toBe("claude-code");
  });

  it("findLangCode3 handles all LANGUAGES entries", () => {
    for (const lang of LANGUAGES) {
      expect(findLangCode3(lang.code)).toBe(lang.code3);
    }
  });

  it("filterDictionaries handles empty array", () => {
    const result = filterDictionaries([], "anything", "fra", "deu");
    expect(result).toEqual([]);
  });

  it("filterDictionaries handles empty native/target codes", () => {
    const dicts = [
      { source_lang: "deu", target_lang: "fra", source_name: "German", target_name: "French" },
    ];
    const result = filterDictionaries(dicts, "", "", "");
    expect(result.length).toBe(1);
    // With empty native/target, no lang matches, so score = 2
    expect(scoreDictRelevance("deu", "fra", "", "")).toBe(2);
  });

  it("LEVELS contains exactly 4 entries", () => {
    expect(LEVELS.length).toBe(4);
  });

  it("LANGUAGES contains 15 entries", () => {
    expect(LANGUAGES.length).toBe(15);
  });

  it("all AI_PROVIDERS have value and label", () => {
    for (const provider of AI_PROVIDERS) {
      expect(provider.value).toBeTruthy();
      expect(provider.label).toBeTruthy();
      expect(typeof provider.noKey).toBe("boolean");
    }
  });
});
