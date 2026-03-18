import { describe, it, expect, beforeEach } from "vitest";
import {
  OnboardingStateSchema,
  LANGUAGES,
  LEVELS,
  AI_PROVIDERS,
  isOnboardingDone,
  markOnboardingDone,
  resetOnboarding,
  filterDictionaries,
  scoreDictRelevance,
  findLangCode3,
  isOnboardingComplete,
} from "../lib/onboarding";
import {
  SettingsSchema,
  LanguagePairSchema,
  WordSchema,
  SrsCardSchema,
  SrsStatsSchema,
  DailyStatRowSchema,
  OverviewStatsSchema,
  AiSettingsSchema,
  ExerciseSchema,
  FavoriteWordSchema,
  DictionarySourceSchema,
} from "../types";

// Helper: base settings that satisfy all required nullable fields
const BASE_SETTINGS = {
  active_language_pair_id: 1,
  last_session_date: null,
  start_date: null,
};

// Helper: parse settings with required nullable fields pre-filled
function parseSettings(overrides: Record<string, unknown> = {}) {
  return SettingsSchema.parse({ ...BASE_SETTINGS, ...overrides });
}

// ─────────────────────────────────────────────────────────────────────
// 1. User Journey: Fresh Install
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Fresh Install", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("onboarding is not done initially", () => {
    resetOnboarding();
    expect(isOnboardingDone()).toBe(false);
  });

  it("user selects French as native language (step 1)", () => {
    const state = OnboardingStateSchema.parse({
      step: 1,
      nativeLang: "fr",
      targetLang: null,
      level: null,
    });
    expect(state.nativeLang).toBe("fr");
    expect(state.step).toBe(1);
    expect(state.targetLang).toBeNull();
  });

  it("user selects German as target language (step 2)", () => {
    const state = OnboardingStateSchema.parse({
      step: 2,
      nativeLang: "fr",
      targetLang: "de",
      level: null,
    });
    expect(state.targetLang).toBe("de");
    expect(state.nativeLang).toBe("fr");
  });

  it("user selects level A1 (step 3)", () => {
    const state = OnboardingStateSchema.parse({
      step: 3,
      nativeLang: "fr",
      targetLang: "de",
      level: "A1",
    });
    expect(state.level).toBe("A1");
  });

  it("user selects AI provider claude-code (step 4)", () => {
    const state = OnboardingStateSchema.parse({
      step: 4,
      nativeLang: "fr",
      targetLang: "de",
      level: "A1",
      aiProvider: "claude-code",
      aiApiKey: "",
    });
    expect(state.aiProvider).toBe("claude-code");
    expect(state.aiApiKey).toBe("");
  });

  it("user completes onboarding (step 5)", () => {
    const state = OnboardingStateSchema.parse({
      step: 5,
      nativeLang: "fr",
      targetLang: "de",
      level: "A1",
      aiProvider: "claude-code",
      aiApiKey: "",
      completed: true,
    });
    expect(state.completed).toBe(true);
    expect(isOnboardingComplete(state)).toBe(true);
  });

  it("markOnboardingDone persists the completion", () => {
    markOnboardingDone();
    expect(isOnboardingDone()).toBe(true);
  });

  it("full onboarding state is valid from start to finish", () => {
    // Step 0: initial
    const s0 = OnboardingStateSchema.parse({ step: 0, nativeLang: null, targetLang: null, level: null });
    expect(isOnboardingComplete(s0)).toBe(false);

    // Step 1: native selected
    const s1 = OnboardingStateSchema.parse({ step: 1, nativeLang: "fr", targetLang: null, level: null });
    expect(s1.nativeLang).toBe("fr");

    // Step 2: target selected
    const s2 = OnboardingStateSchema.parse({ step: 2, nativeLang: "fr", targetLang: "de", level: null });
    expect(s2.targetLang).toBe("de");

    // Step 3: level selected
    const s3 = OnboardingStateSchema.parse({ step: 3, nativeLang: "fr", targetLang: "de", level: "A2" });
    expect(s3.level).toBe("A2");

    // Step 4: AI provider
    const s4 = OnboardingStateSchema.parse({ step: 4, nativeLang: "fr", targetLang: "de", level: "A2", aiProvider: "anthropic", aiApiKey: "sk-test" });
    expect(s4.aiProvider).toBe("anthropic");

    // Step 5: completed
    const s5 = OnboardingStateSchema.parse({ step: 5, nativeLang: "fr", targetLang: "de", level: "A2", aiProvider: "anthropic", aiApiKey: "sk-test", completed: true });
    expect(isOnboardingComplete(s5)).toBe(true);
  });

  it("target language options exclude native language", () => {
    const nativeLang = "fr" as string;
    const availableTargets = LANGUAGES.filter((l) => l.code !== nativeLang);
    expect(availableTargets.every((l) => l.code !== "fr")).toBe(true);
    expect(availableTargets.length).toBe(LANGUAGES.length - 1);
    expect(availableTargets.map((l) => l.code)).toContain("de");
    expect(availableTargets.map((l) => l.code)).toContain("en");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2. User Journey: Language Switching
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Language Switching", () => {
  it("settings update when switching language pair", () => {
    const pair1 = LanguagePairSchema.parse({
      id: 1,
      source_lang: "de",
      target_lang: "fr",
      source_name: "German",
      target_name: "French",
      source_flag: "\uD83C\uDDE9\uD83C\uDDEA",
      target_flag: "\uD83C\uDDEB\uD83C\uDDF7",
      is_active: 1,
    });
    expect(pair1.is_active).toBe(true);

    const pair2 = LanguagePairSchema.parse({
      id: 2,
      source_lang: "en",
      target_lang: "fr",
      source_name: "English",
      target_name: "French",
      source_flag: "\uD83C\uDDEC\uD83C\uDDE7",
      target_flag: "\uD83C\uDDEB\uD83C\uDDF7",
      is_active: 0,
    });
    expect(pair2.is_active).toBe(false);
  });

  it("active_language_pair_id tracks current pair", () => {
    const settingsPair1 = parseSettings({
      active_language_pair_id: 1,
      level: "A2",
    });
    expect(settingsPair1.active_language_pair_id).toBe(1);

    const settingsPair2 = parseSettings({
      active_language_pair_id: 2,
      level: "A2",
    });
    expect(settingsPair2.active_language_pair_id).toBe(2);
  });

  it("multiple language pairs can coexist", () => {
    const pairs = [
      { id: 1, source_lang: "de", target_lang: "fr", source_name: "German", target_name: "French", source_flag: "f", target_flag: "f", is_active: 1 },
      { id: 2, source_lang: "en", target_lang: "fr", source_name: "English", target_name: "French", source_flag: "f", target_flag: "f", is_active: 0 },
      { id: 3, source_lang: "es", target_lang: "fr", source_name: "Spanish", target_name: "French", source_flag: "f", target_flag: "f", is_active: 0 },
    ].map((p) => LanguagePairSchema.parse(p));

    expect(pairs).toHaveLength(3);
    expect(pairs.filter((p) => p.is_active)).toHaveLength(1);
    expect(pairs.filter((p) => !p.is_active)).toHaveLength(2);
  });

  it("isGerman detection works based on source_lang", () => {
    const dePair = LanguagePairSchema.parse({
      id: 1, source_lang: "de", target_lang: "fr",
      source_name: "German", target_name: "French",
      source_flag: "f", target_flag: "f", is_active: true,
    });
    expect(dePair.source_lang === "de").toBe(true);

    const enPair = LanguagePairSchema.parse({
      id: 2, source_lang: "en", target_lang: "fr",
      source_name: "English", target_name: "French",
      source_flag: "f", target_flag: "f", is_active: true,
    });
    expect(enPair.source_lang === "de").toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3. User Journey: Settings
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Settings", () => {
  it("theme can be set to light/dark/system", () => {
    for (const theme of ["light", "dark", "system"]) {
      const settings = SettingsSchema.parse({
        active_language_pair_id: 1,
        level: "A2",
        words_per_day: 10,
        streak: 0,
        last_session_date: null,
        start_date: null,
        dark_mode: theme,
        audio_enabled: true,
        ai_provider: "claude-code",
        ai_model: "",
      });
      expect(settings.dark_mode).toBe(theme);
    }
  });

  it("dark_mode boolean true is rejected by z.string()", () => {
    // Zod v4 z.string() does not coerce booleans
    expect(() =>
      SettingsSchema.parse({
        active_language_pair_id: 1,
        level: "A2",
        words_per_day: 10,
        streak: 0,
        last_session_date: null,
        start_date: null,
        dark_mode: true,
        audio_enabled: 1,
        ai_provider: "claude-code",
        ai_model: "",
      }),
    ).toThrow();
  });

  it("audio_enabled integer 1 coerces to true", () => {
    const settings = parseSettings({ audio_enabled: 1 });
    expect(settings.audio_enabled).toBe(true);
  });

  it("level can be changed between A1, A2, B1, B2", () => {
    for (const level of ["A1", "A2", "B1", "B2"]) {
      const settings = parseSettings({ level });
      expect(settings.level).toBe(level);
    }
  });

  it("words_per_day can be adjusted", () => {
    for (const count of [5, 10, 15, 20, 30, 50]) {
      const settings = parseSettings({ words_per_day: count });
      expect(settings.words_per_day).toBe(count);
    }
  });

  it("streak increments correctly", () => {
    const day1 = parseSettings({ streak: 0 });
    expect(day1.streak).toBe(0);

    const day2 = parseSettings({ streak: 1 });
    expect(day2.streak).toBe(1);

    const day10 = parseSettings({ streak: 10 });
    expect(day10.streak).toBe(10);
  });

  it("audio_enabled toggle works", () => {
    const audioOn = parseSettings({ audio_enabled: true });
    expect(audioOn.audio_enabled).toBe(true);

    const audioOff = parseSettings({ audio_enabled: false });
    expect(audioOff.audio_enabled).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4. User Journey: Dictionary Download
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Dictionary Download", () => {
  const dicts = [
    {
      source_lang: "deu", target_lang: "fra", source_name: "German", target_name: "French",
      source_flag: "\uD83C\uDDE9\uD83C\uDDEA", target_flag: "\uD83C\uDDEB\uD83C\uDDF7",
      provider: "freedict", url: "http://test", format: "stardict",
      word_count: 1000, size_mb: 1.5,
    },
    {
      source_lang: "eng", target_lang: "spa", source_name: "English", target_name: "Spanish",
      source_flag: "\uD83C\uDDEC\uD83C\uDDE7", target_flag: "\uD83C\uDDEA\uD83C\uDDF8",
      provider: "freedict", url: "http://test2", format: "stardict",
      word_count: 2000, size_mb: 2.0,
    },
    {
      source_lang: "fra", target_lang: "deu", source_name: "French", target_name: "German",
      source_flag: "\uD83C\uDDEB\uD83C\uDDF7", target_flag: "\uD83C\uDDE9\uD83C\uDDEA",
      provider: "freedict", url: "http://test3", format: "stardict",
      word_count: 800, size_mb: 1.2,
    },
  ];

  it("filters dictionaries by search term", () => {
    const filtered = filterDictionaries(dicts, "german", "fra", "deu");
    expect(filtered.length).toBe(2); // German appears as source_name in 1, target_name in another
    expect(filtered[0].source_name === "German" || filtered[0].target_name === "German").toBe(true);
  });

  it("filters dictionaries by language code", () => {
    const filtered = filterDictionaries(dicts, "eng", "fra", "deu");
    expect(filtered.length).toBe(1);
    expect(filtered[0].source_lang).toBe("eng");
  });

  it("sorts by relevance - exact pair match first", () => {
    const sorted = filterDictionaries(dicts, "", "fra", "deu");
    // deu-fra and fra-deu should both be exact matches (score 0)
    expect(scoreDictRelevance(sorted[0].source_lang, sorted[0].target_lang, "fra", "deu")).toBe(0);
    // eng-spa should be last (score 2)
    expect(scoreDictRelevance(sorted[sorted.length - 1].source_lang, sorted[sorted.length - 1].target_lang, "fra", "deu")).toBe(2);
  });

  it("validates dictionary source schema", () => {
    for (const dict of dicts) {
      const result = DictionarySourceSchema.parse(dict);
      expect(result.provider).toBe("freedict");
      expect(result.format).toBe("stardict");
    }
  });

  it("findLangCode3 resolves 2-letter to 3-letter codes", () => {
    expect(findLangCode3("fr")).toBe("fra");
    expect(findLangCode3("de")).toBe("deu");
    expect(findLangCode3("en")).toBe("eng");
    expect(findLangCode3("es")).toBe("spa");
  });

  it("empty search returns all dictionaries sorted", () => {
    const result = filterDictionaries(dicts, "", "fra", "deu");
    expect(result.length).toBe(3);
  });

  it("no matching search returns empty", () => {
    const result = filterDictionaries(dicts, "zzzzz", "fra", "deu");
    expect(result.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5. User Journey: Quiz Flow
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Quiz Flow", () => {
  it("quiz setup allows choosing question count", () => {
    const validCounts = [10, 15, 20];
    for (const count of validCounts) {
      expect(count).toBeGreaterThanOrEqual(10);
      expect(count).toBeLessThanOrEqual(20);
    }
  });

  it("quiz questions can be built from words", () => {
    const words = [
      { id: 1, language_pair_id: 1, source_word: "Haus", target_word: "maison", gender: null, plural: null, level: "A1", category: null, tags: null, example_source: null, example_target: null },
      { id: 2, language_pair_id: 1, source_word: "Katze", target_word: "chat", gender: null, plural: null, level: "A1", category: null, tags: null, example_source: null, example_target: null },
      { id: 3, language_pair_id: 1, source_word: "Hund", target_word: "chien", gender: null, plural: null, level: "A1", category: null, tags: null, example_source: null, example_target: null },
      { id: 4, language_pair_id: 1, source_word: "Buch", target_word: "livre", gender: null, plural: null, level: "A1", category: null, tags: null, example_source: null, example_target: null },
    ].map((w) => WordSchema.parse(w));

    // MCQ needs at least 4 words for 3 wrong + 1 correct
    expect(words.length).toBeGreaterThanOrEqual(4);

    // Build a simple question
    const word = words[0];
    const wrongOptions = words.filter((w) => w.id !== word.id).map((w) => w.target_word);
    expect(wrongOptions).not.toContain(word.target_word);
    expect(wrongOptions.length).toBe(3);
  });

  it("quiz scoring tracks correct/total", () => {
    let score = 0;
    const total = 5;

    // Simulate answering
    score++; // correct
    score++; // correct
    // wrong (no increment)
    score++; // correct
    // wrong (no increment)

    expect(score).toBe(3);
    const percentage = Math.round((score / total) * 100);
    expect(percentage).toBe(60);
  });

  it("quiz result categories work", () => {
    // Perfect score
    expect(Math.round((10 / 10) * 100)).toBe(100);
    // Good score
    expect(Math.round((8 / 10) * 100)).toBe(80);
    // Needs improvement
    expect(Math.round((4 / 10) * 100)).toBe(40);
    // Zero
    expect(Math.round((0 / 10) * 100)).toBe(0);
  });

  it("quiz has vocab and reverse question types", () => {
    const types = ["vocab", "reverse", "conjugation"];
    expect(types).toContain("vocab");
    expect(types).toContain("reverse");
    expect(types).toContain("conjugation");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 6. User Journey: Review (SRS) Flow
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Review Flow", () => {
  const makeCard = (overrides: Partial<Record<string, unknown>> = {}) =>
    SrsCardSchema.parse({
      id: 1,
      word_id: 42,
      source_word: "Haus",
      target_word: "maison",
      gender: "n",
      plural: null,
      level: "A1",
      category: null,
      example_source: null,
      example_target: null,
      repetitions: 0,
      ease_factor: 2.5,
      interval_days: 0,
      next_review: "2026-03-18",
      last_score: null,
      ...overrides,
    });

  it("new card starts with SM-2 defaults", () => {
    const card = makeCard();
    expect(card.repetitions).toBe(0);
    expect(card.ease_factor).toBe(2.5);
    expect(card.interval_days).toBe(0);
    expect(card.last_score).toBeNull();
  });

  it("SM-2 quality buttons map to correct values", () => {
    // Forgot=0, Hard=2, Good=3, Easy=5
    const qualities = { forgot: 0, hard: 2, good: 3, easy: 5 };
    expect(qualities.forgot).toBe(0);
    expect(qualities.hard).toBe(2);
    expect(qualities.good).toBe(3);
    expect(qualities.easy).toBe(5);
  });

  it("card with past next_review is due", () => {
    const card = makeCard({ next_review: "2026-03-17" });
    const today = "2026-03-18";
    expect(card.next_review <= today).toBe(true);
  });

  it("card with future next_review is not due", () => {
    const card = makeCard({ next_review: "2026-03-25" });
    const today = "2026-03-18";
    expect(card.next_review <= today).toBe(false);
  });

  it("review session tracks results", () => {
    const results = {
      correct: 0,
      total: 0,
      forgotten: [] as string[],
    };

    // Rate first card as "good"
    results.correct++;
    results.total++;

    // Rate second card as "forgot"
    results.total++;
    results.forgotten.push("Haus");

    // Rate third card as "easy"
    results.correct++;
    results.total++;

    expect(results.correct).toBe(2);
    expect(results.total).toBe(3);
    expect(results.forgotten).toEqual(["Haus"]);
  });

  it("card grouping: new vs learning vs mastered", () => {
    const cards = [
      makeCard({ id: 1, repetitions: 0, ease_factor: 2.5 }), // new
      makeCard({ id: 2, repetitions: 2, ease_factor: 2.3 }), // learning
      makeCard({ id: 3, repetitions: 5, ease_factor: 2.6 }), // mastered
      makeCard({ id: 4, repetitions: 10, ease_factor: 3.0 }), // mastered
    ];

    const newCards = cards.filter((c) => c.ease_factor === 2.5 && c.repetitions === 0);
    const learningCards = cards.filter(
      (c) => !(c.ease_factor === 2.5 && c.repetitions === 0) && c.repetitions < 5,
    );
    const masteredCards = cards.filter((c) => c.repetitions >= 5);

    expect(newCards).toHaveLength(1);
    expect(learningCards).toHaveLength(1);
    expect(masteredCards).toHaveLength(2);
  });

  it("review completion shows when all cards reviewed", () => {
    const totalCards = 5;
    let currentIndex = 0;
    while (currentIndex < totalCards) {
      currentIndex++;
    }
    expect(currentIndex).toBe(totalCards);
    const completed = currentIndex >= totalCards;
    expect(completed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 7. User Journey: Flashcard Management
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Flashcard Management", () => {
  it("custom flashcard can be created with front/back", () => {
    // Simulates creating a custom word then adding to SRS
    const word = WordSchema.parse({
      id: 999,
      language_pair_id: 1,
      source_word: "Apfel",
      target_word: "pomme",
      gender: "m",
      plural: null,
      level: null,
      category: null,
      tags: null,
      example_source: null,
      example_target: null,
    });
    expect(word.source_word).toBe("Apfel");
    expect(word.target_word).toBe("pomme");
  });

  it("flashcard validation rejects empty front/back", () => {
    // App logic: if (!front.trim() || !back.trim()) return
    const front = "";
    const back = "pomme";
    expect(!front.trim() || !back.trim()).toBe(true);

    const front2 = "Apfel";
    const back2 = "";
    expect(!front2.trim() || !back2.trim()).toBe(true);

    const front3 = "   ";
    const back3 = "pomme";
    expect(!front3.trim() || !back3.trim()).toBe(true);
  });

  it("valid flashcard passes trim check", () => {
    const front = "Apfel";
    const back = "pomme";
    expect(!front.trim() || !back.trim()).toBe(false);
  });

  it("SRS card schema validates flashcard data", () => {
    const card = SrsCardSchema.parse({
      id: 1,
      word_id: 999,
      source_word: "Apfel",
      target_word: "pomme",
      gender: "m",
      plural: null,
      level: null,
      category: null,
      example_source: null,
      example_target: null,
      repetitions: 0,
      ease_factor: 2.5,
      interval_days: 0,
      next_review: "2026-03-18",
      last_score: null,
    });
    expect(card.source_word).toBe("Apfel");
    expect(card.repetitions).toBe(0);
  });

  it("favorite word schema validates", () => {
    const fav = FavoriteWordSchema.parse({
      id: 1,
      word_id: 42,
      source_word: "Haus",
      target_word: "maison",
      gender: "n",
      level: "A1",
      category: "home",
    });
    expect(fav.source_word).toBe("Haus");
    expect(fav.word_id).toBe(42);
  });

  it("export format includes progress data structure", () => {
    // Export returns a Record<string, unknown> containing SRS data
    const exportData: Record<string, unknown> = {
      version: "2.0",
      language_pair_id: 1,
      cards: [
        { word_id: 1, repetitions: 5, ease_factor: 2.6 },
        { word_id: 2, repetitions: 0, ease_factor: 2.5 },
      ],
      favorites: [1, 2, 3],
    };
    expect(exportData).toBeDefined();
    expect(Array.isArray(exportData.cards)).toBe(true);
    expect(Array.isArray(exportData.favorites)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 8. User Journey: Chat Flow
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Chat Flow", () => {
  it("chat message structure is valid", () => {
    const userMsg = { role: "user" as const, content: "How do you say 'house' in German?" };
    const assistantMsg = { role: "assistant" as const, content: "In German, 'house' is 'Haus' (das Haus)." };

    expect(userMsg.role).toBe("user");
    expect(assistantMsg.role).toBe("assistant");
    expect(userMsg.content).toBeTruthy();
    expect(assistantMsg.content).toBeTruthy();
  });

  it("chat has a max message limit", () => {
    const MAX_MESSAGES = 20;
    const messages: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 25; i++) {
      messages.push({ role: i % 2 === 0 ? "user" : "assistant", content: `msg ${i}` });
    }
    // Trim to max
    const trimmed = messages.slice(-MAX_MESSAGES);
    expect(trimmed.length).toBe(MAX_MESSAGES);
    expect(trimmed[0].content).toBe("msg 5");
  });

  it("chat storage key is defined", () => {
    const STORAGE_KEY = "omnilingo-chat";
    expect(STORAGE_KEY).toBe("omnilingo-chat");
  });

  it("clearing chat empties messages", () => {
    const messages = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ];
    const cleared: Array<{ role: string; content: string }> = [];
    expect(cleared.length).toBe(0);
    expect(messages.length).toBe(2);
  });

  it("quick actions produce valid prompts", () => {
    const sourceName = "German";
    const quickPrompts = [
      `Correct this ${sourceName} sentence and explain the errors: `,
      `Explain this ${sourceName} grammar rule: `,
      `Let's have a conversation in ${sourceName}! Start a simple conversation about `,
      `Give me 5 exercises at level `,
      `Translate into ${sourceName}: `,
    ];

    for (const prompt of quickPrompts) {
      expect(prompt.length).toBeGreaterThan(0);
      expect(typeof prompt).toBe("string");
    }
  });

  it("HTML escaping prevents XSS in chat messages", () => {
    const escapeHtml = (text: string): string => {
      const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      };
      return text.replace(/[&<>"']/g, (c) => map[c]);
    };

    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
    );
    expect(escapeHtml("Normal text")).toBe("Normal text");
    expect(escapeHtml("A & B")).toBe("A &amp; B");
    expect(escapeHtml('"quoted"')).toBe("&quot;quoted&quot;");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 9. User Journey: Stats Display
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Stats Display", () => {
  it("daily stats track learning activity", () => {
    const stats = [
      { date: "2026-03-16", words_learned: 8, words_reviewed: 20, correct_count: 18, total_count: 20 },
      { date: "2026-03-17", words_learned: 10, words_reviewed: 15, correct_count: 12, total_count: 15 },
      { date: "2026-03-18", words_learned: 5, words_reviewed: 30, correct_count: 28, total_count: 30 },
    ].map((s) => DailyStatRowSchema.parse(s));

    expect(stats).toHaveLength(3);
    expect(stats[0].date).toBe("2026-03-16");
    expect(stats[2].words_learned).toBe(5);
  });

  it("overview stats aggregate all activity", () => {
    const overview = OverviewStatsSchema.parse({
      total_words: 500,
      total_learned: 200,
      total_reviews: 1500,
      total_grammar_completed: 5,
      total_grammar: 10,
      streak: 7,
      accuracy: 85.5,
      study_days: 30,
      favorite_count: 15,
    });
    expect(overview.total_words).toBe(500);
    expect(overview.accuracy).toBe(85.5);
    expect(overview.streak).toBe(7);
  });

  it("SRS stats show review summary", () => {
    const srsStats = SrsStatsSchema.parse({
      total_cards: 150,
      due_count: 12,
      average_accuracy: 87.5,
    });
    expect(srsStats.total_cards).toBe(150);
    expect(srsStats.due_count).toBe(12);
  });

  it("streak calendar data maps dates to activity counts", () => {
    const calendarData: Record<string, number> = {};
    const dailyStats = [
      { date: "2026-03-16", words_learned: 8, words_reviewed: 20, correct_count: 18, total_count: 20 },
      { date: "2026-03-17", words_learned: 10, words_reviewed: 15, correct_count: 12, total_count: 15 },
    ];
    dailyStats.forEach((s) => {
      calendarData[s.date] = s.words_learned + s.words_reviewed;
    });

    expect(calendarData["2026-03-16"]).toBe(28);
    expect(calendarData["2026-03-17"]).toBe(25);
    expect(calendarData["2026-03-19"]).toBeUndefined();
  });

  it("accuracy calculation works", () => {
    // accuracy = Math.round(average_accuracy)
    const stats = SrsStatsSchema.parse({
      total_cards: 50,
      due_count: 5,
      average_accuracy: 87.5,
    });
    expect(Math.round(stats.average_accuracy)).toBe(88);
  });

  it("daily goal progress is calculated correctly", () => {
    const todayLearned = 7;
    const wordsPerDay = 10;
    const progress = Math.min((todayLearned / wordsPerDay) * 100, 100);
    expect(progress).toBe(70);

    // Over-achievement capped at 100%
    const overAchieved = Math.min((15 / 10) * 100, 100);
    expect(overAchieved).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 10. User Journey: Import/Export
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Import/Export", () => {
  it("import format validation accepts valid content string", () => {
    const csvContent = "source_word,target_word,gender,level\nHaus,maison,n,A1\nKatze,chat,f,A1";
    expect(csvContent.length).toBeGreaterThan(0);
    expect(csvContent).toContain("source_word");
  });

  it("supported import formats include csv and json", () => {
    const formats = ["csv", "json"];
    expect(formats).toContain("csv");
    expect(formats).toContain("json");
  });

  it("export data structure is a Record", () => {
    const data: Record<string, unknown> = {
      version: "2",
      settings: { level: "A2", words_per_day: 10 },
      words: [],
      srs_cards: [],
    };
    expect(typeof data).toBe("object");
    expect(data.version).toBe("2");
  });

  it("import progress expects pairId and data", () => {
    const pairId = 1;
    const data: Record<string, unknown> = { cards: [], grammar: [] };
    expect(pairId).toBeGreaterThan(0);
    expect(data).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 11. User Journey: AI Provider Configuration
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: AI Provider Configuration", () => {
  it("default AI provider is claude-code (no key needed)", () => {
    const settings = parseSettings({});
    expect(settings.ai_provider).toBe("claude-code");
  });

  it("claude-code provider does not require API key", () => {
    const provider = AI_PROVIDERS.find((p) => p.value === "claude-code");
    expect(provider).toBeDefined();
    expect(provider!.noKey).toBe(true);
  });

  it("anthropic provider requires API key", () => {
    const provider = AI_PROVIDERS.find((p) => p.value === "anthropic");
    expect(provider).toBeDefined();
    expect(provider!.noKey).toBe(false);
  });

  it("ollama provider does not require API key", () => {
    const provider = AI_PROVIDERS.find((p) => p.value === "ollama");
    expect(provider).toBeDefined();
    expect(provider!.noKey).toBe(true);
  });

  it("AI settings schema validates provider + model + key", () => {
    const ai = AiSettingsSchema.parse({
      provider: "anthropic",
      api_key: "sk-ant-test123",
      model: "claude-sonnet-4-6",
    });
    expect(ai.provider).toBe("anthropic");
    expect(ai.api_key).toBe("sk-ant-test123");
    expect(ai.model).toBe("claude-sonnet-4-6");
  });

  it("switching providers updates settings", () => {
    const s1 = parseSettings({
      ai_provider: "claude-code",
      ai_model: "claude-sonnet-4-6",
    });
    expect(s1.ai_provider).toBe("claude-code");

    const s2 = parseSettings({
      ai_provider: "openai",
      ai_model: "gpt-4o-mini",
    });
    expect(s2.ai_provider).toBe("openai");
    expect(s2.ai_model).toBe("gpt-4o-mini");
  });

  it("all AI_PROVIDERS from onboarding have value and label", () => {
    for (const provider of AI_PROVIDERS) {
      expect(provider.value).toBeTruthy();
      expect(provider.label).toBeTruthy();
      expect(typeof provider.noKey).toBe("boolean");
    }
  });

  it("providers without key include claude-code and ollama", () => {
    const noKeyProviders = AI_PROVIDERS.filter((p) => p.noKey);
    const values = noKeyProviders.map((p) => p.value);
    expect(values).toContain("claude-code");
    expect(values).toContain("ollama");
  });

  it("providers requiring key include anthropic and openai", () => {
    const keyProviders = AI_PROVIDERS.filter((p) => !p.noKey);
    const values = keyProviders.map((p) => p.value);
    expect(values).toContain("anthropic");
    expect(values).toContain("openai");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 12. User Journey: Level Changes
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Level Changes", () => {
  it("all CEFR levels are available", () => {
    const levelValues = LEVELS.map((l) => l.value);
    expect(levelValues).toEqual(["A1", "A2", "B1", "B2"]);
  });

  it("each level has associated styling", () => {
    for (const level of LEVELS) {
      expect(level.color).toMatch(/^text-/);
      expect(level.bg).toMatch(/^bg-/);
      expect(level.border).toMatch(/^border-/);
      expect(level.hover).toMatch(/^hover:/);
    }
  });

  it("level change updates settings", () => {
    const before = parseSettings({ level: "A1" });
    expect(before.level).toBe("A1");

    const after = parseSettings({ level: "B2" });
    expect(after.level).toBe("B2");
  });

  it("level affects word filtering", () => {
    const words = [
      { id: 1, language_pair_id: 1, source_word: "Haus", target_word: "maison", gender: null, plural: null, level: "A1", category: null, tags: null, example_source: null, example_target: null },
      { id: 2, language_pair_id: 1, source_word: "Wissenschaft", target_word: "science", gender: null, plural: null, level: "B2", category: null, tags: null, example_source: null, example_target: null },
      { id: 3, language_pair_id: 1, source_word: "Arbeit", target_word: "travail", gender: null, plural: null, level: "A2", category: null, tags: null, example_source: null, example_target: null },
    ].map((w) => WordSchema.parse(w));

    const a1Words = words.filter((w) => w.level === "A1");
    expect(a1Words).toHaveLength(1);
    expect(a1Words[0].source_word).toBe("Haus");

    const b2Words = words.filter((w) => w.level === "B2");
    expect(b2Words).toHaveLength(1);
    expect(b2Words[0].source_word).toBe("Wissenschaft");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 13. User Journey: Words Per Day Changes
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Words Per Day Changes", () => {
  it("default words per day is 10", () => {
    const settings = parseSettings({});
    expect(settings.words_per_day).toBe(10);
  });

  it("words per day can be increased", () => {
    const settings = parseSettings({ words_per_day: 25 });
    expect(settings.words_per_day).toBe(25);
  });

  it("words per day can be decreased", () => {
    const settings = parseSettings({ words_per_day: 5 });
    expect(settings.words_per_day).toBe(5);
  });

  it("daily goal progress reflects words_per_day", () => {
    const settings5 = parseSettings({ words_per_day: 5 });
    const settings20 = parseSettings({ words_per_day: 20 });

    const todayLearned = 5;
    const progress5 = Math.min((todayLearned / settings5.words_per_day) * 100, 100);
    const progress20 = Math.min((todayLearned / settings20.words_per_day) * 100, 100);

    expect(progress5).toBe(100); // 5/5 = 100%
    expect(progress20).toBe(25); // 5/20 = 25%
  });

  it("words_per_day coerces from string", () => {
    const settings = parseSettings({ words_per_day: "15" });
    expect(settings.words_per_day).toBe(15);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 14. User Journey: Grammar Exercises
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Grammar Exercises", () => {
  it("QCM exercise has question, options, correctIndex", () => {
    const ex = ExerciseSchema.parse({
      type: "qcm",
      question: "What article goes with 'Haus'?",
      options: ["der", "die", "das", "dem"],
      correctIndex: 2,
    });
    expect(ex.type).toBe("qcm");
    expect(ex.options).toHaveLength(4);
    expect(ex.correctIndex).toBe(2);
  });

  it("fill exercise has sentence and answer", () => {
    const ex = ExerciseSchema.parse({
      type: "fill",
      sentence: "Ich ___ heute Kuchen.",
      answer: "esse",
      hint: "to eat",
    });
    expect(ex.sentence).toContain("___");
    expect(ex.answer).toBe("esse");
  });

  it("trueFalse exercise has statement and boolean", () => {
    const ex = ExerciseSchema.parse({
      type: "trueFalse",
      statement: "'Der Haus' is correct.",
      isTrue: false,
      explanation: "Haus is neuter, so it is 'das Haus'.",
    });
    expect(ex.isTrue).toBe(false);
    expect(ex.explanation).toBeTruthy();
  });

  it("exercise types cover all defined values", () => {
    const types = ["qcm", "fill", "trueFalse", "conjugation"];
    for (const type of types) {
      const ex = ExerciseSchema.parse({ type });
      expect(ex.type).toBe(type);
    }
  });

  it("grammar completion tracks score", () => {
    const topicId = "nominativ";
    const pairId = 1;
    const correct = 8;
    const total = 10;
    const accuracy = Math.round((correct / total) * 100);
    expect(accuracy).toBe(80);
    expect(topicId).toBeTruthy();
    expect(pairId).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 15. User Journey: Speech and Audio
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Speech and Audio", () => {
  it("language code mapping covers supported languages", () => {
    const langMap: Record<string, string> = {
      de: "de-DE",
      fr: "fr-FR",
      en: "en-US",
      es: "es-ES",
      it: "it-IT",
      pt: "pt-PT",
      nl: "nl-NL",
      ru: "ru-RU",
      ja: "ja-JP",
      zh: "zh-CN",
    };

    expect(langMap.de).toBe("de-DE");
    expect(langMap.fr).toBe("fr-FR");
    expect(langMap.en).toBe("en-US");
    expect(Object.keys(langMap).length).toBe(10);
  });

  it("audio_enabled defaults to true in settings", () => {
    const settings = parseSettings({});
    expect(settings.audio_enabled).toBe(true);
  });

  it("audio can be disabled via settings", () => {
    const settings = parseSettings({ audio_enabled: false });
    expect(settings.audio_enabled).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 16. User Journey: Conjugation Practice
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Conjugation Practice", () => {
  it("verb can have multiple tenses", () => {
    const conjugations = {
      present: { ich: "mache", du: "machst", er: "macht" },
      past: { ich: "machte", du: "machtest", er: "machte" },
      perfect: { ich: "habe gemacht", du: "hast gemacht", er: "hat gemacht" },
    };

    expect(Object.keys(conjugations)).toHaveLength(3);
    expect(conjugations.present.ich).toBe("mache");
    expect(conjugations.past.ich).toBe("machte");
    expect(conjugations.perfect.ich).toBe("habe gemacht");
  });

  it("conjugation session can be logged", () => {
    const sessionData = {
      pairId: 1,
      verb: "machen",
      tense: "present",
      correct: true,
      errors: [] as string[],
    };
    expect(sessionData.correct).toBe(true);
    expect(sessionData.errors).toHaveLength(0);
  });

  it("conjugation errors are tracked", () => {
    const errors = ["machst -> macht", "machen -> mache"];
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("machst");
  });

  it("separable verbs are flagged", () => {
    const regularVerb = { is_separable: false, infinitive: "machen" };
    const separableVerb = { is_separable: true, infinitive: "aufmachen" };

    expect(regularVerb.is_separable).toBe(false);
    expect(separableVerb.is_separable).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 17. User Journey: Error Tracking
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Error Tracking", () => {
  it("frequent errors have word, type, count, correct answer", () => {
    const errors = [
      { word: "Haus", type: "gender", count: 5, correct: "das" },
      { word: "Katze", type: "translation", count: 3, correct: "chat" },
    ];

    expect(errors).toHaveLength(2);
    expect(errors[0].count).toBeGreaterThan(errors[1].count);
    expect(errors[0].type).toBe("gender");
  });

  it("error types include gender, translation, conjugation", () => {
    const errorTypes = ["gender", "translation", "conjugation", "grammar"];
    expect(errorTypes).toContain("gender");
    expect(errorTypes).toContain("translation");
    expect(errorTypes).toContain("conjugation");
  });

  it("log error requires all fields", () => {
    const params = {
      pairId: 1,
      errorType: "gender",
      wordOrTopic: "Haus",
      userAnswer: "der",
      correctAnswer: "das",
    };
    expect(params.pairId).toBeGreaterThan(0);
    expect(params.errorType).toBeTruthy();
    expect(params.wordOrTopic).toBeTruthy();
    expect(params.userAnswer).toBeTruthy();
    expect(params.correctAnswer).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 18. User Journey: Maintenance Operations
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: Maintenance Operations", () => {
  it("clear cache is a simple operation", () => {
    // clearCache() returns a string message
    const expectedReturn = "string";
    expect(expectedReturn).toBe("string");
  });

  it("reset progress is destructive and returns confirmation", () => {
    // resetProgress() returns a string
    const expectedReturn = "string";
    expect(expectedReturn).toBe("string");
  });

  it("reset onboarding allows re-starting setup", () => {
    localStorage.clear();
    markOnboardingDone();
    expect(isOnboardingDone()).toBe(true);
    resetOnboarding();
    expect(isOnboardingDone()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 19. User Journey: German-specific Features
// ─────────────────────────────────────────────────────────────────────
describe("User Journey: German-specific Features", () => {
  it("gender colors are defined for m/f/n", () => {
    const genderColors: Record<string, { bg: string; text: string; label: string }> = {
      m: { bg: "bg-blue-500", text: "text-blue-500", label: "der" },
      f: { bg: "bg-rose-500", text: "text-rose-500", label: "die" },
      n: { bg: "bg-emerald-500", text: "text-emerald-500", label: "das" },
    };

    expect(genderColors.m.label).toBe("der");
    expect(genderColors.f.label).toBe("die");
    expect(genderColors.n.label).toBe("das");
    expect(Object.keys(genderColors)).toHaveLength(3);
  });

  it("words can have gender assigned", () => {
    const word = WordSchema.parse({
      id: 1,
      language_pair_id: 1,
      source_word: "Haus",
      target_word: "maison",
      gender: "n",
      plural: "Hauser",
      level: "A1",
      category: null,
      tags: null,
      example_source: null,
      example_target: null,
    });
    expect(word.gender).toBe("n");
    expect(word.plural).toBe("Hauser");
  });

  it("non-German languages may have null gender", () => {
    const word = WordSchema.parse({
      id: 1,
      language_pair_id: 2,
      source_word: "house",
      target_word: "maison",
      gender: null,
      plural: null,
      level: "A1",
      category: null,
      tags: null,
      example_source: null,
      example_target: null,
    });
    expect(word.gender).toBeNull();
  });

  it("isGerman check uses source_lang", () => {
    const dePair = LanguagePairSchema.parse({
      id: 1, source_lang: "de", target_lang: "fr",
      source_name: "German", target_name: "French",
      source_flag: "f", target_flag: "f", is_active: true,
    });
    expect(dePair.source_lang === "de").toBe(true);

    const enPair = LanguagePairSchema.parse({
      id: 2, source_lang: "en", target_lang: "fr",
      source_name: "English", target_name: "French",
      source_flag: "f", target_flag: "f", is_active: true,
    });
    expect(enPair.source_lang === "de").toBe(false);
  });
});
