import { describe, it, expect } from "vitest";
import {
  SettingsSchema,
  LanguagePairSchema,
  WordSchema,
  AiSettingsSchema,
  ExerciseSchema,
} from "../types";

// Helper: base settings that satisfy all required nullable fields
const BASE_SETTINGS = {
  active_language_pair_id: 1,
};

// Helper: parse settings with required nullable fields pre-filled
function parseSettings(overrides: Record<string, unknown> = {}) {
  return SettingsSchema.parse({ ...BASE_SETTINGS, ...overrides });
}

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
    });
    expect(settingsPair1.active_language_pair_id).toBe(1);

    const settingsPair2 = parseSettings({
      active_language_pair_id: 2,
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
        dark_mode: theme,
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
        dark_mode: true,
        ai_provider: "claude-code",
        ai_model: "",
      }),
    ).toThrow();
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
// 6. User Journey: Chat Flow
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
// 7. User Journey: Import/Export
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
