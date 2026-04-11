import { describe, it, expect } from "vitest";
import {
  SettingsSchema,
  LanguagePairSchema,
  GrammarTopicSchema,
  ExerciseSchema,
  VerbSchema,
  AiSettingsSchema,
  ConversationScenarioSchema,
  ConversationSessionSchema,
} from "../types";

// ─────────────────────────────────────────────────────────────────────
// 1. SettingsSchema
// ─────────────────────────────────────────────────────────────────────
describe("SettingsSchema", () => {
  const validSettings = {
    active_language_pair_id: 1,
    dark_mode: "system",
    ai_provider: "claude-code",
    ai_model: "",
  };

  it("accepts fully valid settings", () => {
    const result = SettingsSchema.parse(validSettings);
    expect(result.active_language_pair_id).toBe(1);
    expect(result.dark_mode).toBe("system");
    expect(result.ai_provider).toBe("claude-code");
    expect(result.ai_model).toBe("");
  });

  it("applies defaults for missing optional fields", () => {
    const result = SettingsSchema.parse({
      active_language_pair_id: null,
    });
    expect(result.dark_mode).toBe("system");
    expect(result.ai_provider).toBe("claude-code");
    expect(result.ai_model).toBe("");
  });

  it("accepts nullable active_language_pair_id", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      active_language_pair_id: null,
    });
    expect(result.active_language_pair_id).toBeNull();
  });

  it("accepts dark_mode as 'light'", () => {
    const result = SettingsSchema.parse({ ...validSettings, dark_mode: "light" });
    expect(result.dark_mode).toBe("light");
  });

  it("accepts dark_mode as 'dark'", () => {
    const result = SettingsSchema.parse({ ...validSettings, dark_mode: "dark" });
    expect(result.dark_mode).toBe("dark");
  });

  it("accepts dark_mode as 'system'", () => {
    const result = SettingsSchema.parse({ ...validSettings, dark_mode: "system" });
    expect(result.dark_mode).toBe("system");
  });

  it("rejects dark_mode as boolean (not coerced)", () => {
    // Zod v4 z.string() does not coerce booleans - this should throw
    expect(() =>
      SettingsSchema.parse({
        ...validSettings,
        dark_mode: true as unknown,
      }),
    ).toThrow();
  });

  it("accepts various ai_provider values", () => {
    for (const provider of ["claude-code", "anthropic", "openai", "gemini", "ollama"]) {
      const result = SettingsSchema.parse({ ...validSettings, ai_provider: provider });
      expect(result.ai_provider).toBe(provider);
    }
  });

  it("accepts ai_model with model string", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      ai_model: "claude-sonnet-4-6",
    });
    expect(result.ai_model).toBe("claude-sonnet-4-6");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2. LanguagePairSchema
// ─────────────────────────────────────────────────────────────────────
describe("LanguagePairSchema", () => {
  const validPair = {
    id: 1,
    source_lang: "de",
    target_lang: "fr",
    source_name: "German",
    target_name: "French",
    source_flag: "\uD83C\uDDE9\uD83C\uDDEA",
    target_flag: "\uD83C\uDDEB\uD83C\uDDF7",
    is_active: true,
  };

  it("accepts a fully valid language pair", () => {
    const result = LanguagePairSchema.parse(validPair);
    expect(result.id).toBe(1);
    expect(result.source_lang).toBe("de");
    expect(result.target_lang).toBe("fr");
    expect(result.source_name).toBe("German");
    expect(result.target_name).toBe("French");
    expect(result.is_active).toBe(true);
  });

  it("coerces is_active from integer 1 to true", () => {
    const result = LanguagePairSchema.parse({ ...validPair, is_active: 1 });
    expect(result.is_active).toBe(true);
  });

  it("coerces is_active from integer 0 to false", () => {
    const result = LanguagePairSchema.parse({ ...validPair, is_active: 0 });
    expect(result.is_active).toBe(false);
  });

  it("is_active false for string 'false'", () => {
    const result = LanguagePairSchema.parse({ ...validPair, is_active: "false" });
    // preprocess: v === true || v === 1 -> neither, so false
    expect(result.is_active).toBe(false);
  });

  it("is_active true for boolean true", () => {
    const result = LanguagePairSchema.parse({ ...validPair, is_active: true });
    expect(result.is_active).toBe(true);
  });

  it("is_active false for boolean false", () => {
    const result = LanguagePairSchema.parse({ ...validPair, is_active: false });
    expect(result.is_active).toBe(false);
  });

  it("rejects missing id", () => {
    const { id: _, ...noId } = validPair;
    expect(() => LanguagePairSchema.parse(noId)).toThrow();
  });

  it("rejects missing source_lang", () => {
    const { source_lang: _, ...noLang } = validPair;
    expect(() => LanguagePairSchema.parse(noLang)).toThrow();
  });

  it("accepts emoji flags", () => {
    const result = LanguagePairSchema.parse(validPair);
    expect(result.source_flag).toBeTruthy();
    expect(result.target_flag).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 7. GrammarTopicSchema
// ─────────────────────────────────────────────────────────────────────
describe("GrammarTopicSchema", () => {
  const validTopic = {
    id: "nominativ",
    language_pair_id: 1,
    level: "A1",
    display_order: 1,
    title: "Le nominatif",
    title_source: "Der Nominativ",
    explanation: "The nominative case is used for subjects.",
    key_points: ["Subject case", "Used with articles der/die/das"],
    examples: [
      { source: "Der Hund schlaeft.", target: "Le chien dort.", highlight: "Der" },
    ],
    exercises: null,
  };

  it("accepts a valid grammar topic", () => {
    const result = GrammarTopicSchema.parse(validTopic);
    expect(result.id).toBe("nominativ");
    expect(result.title).toBe("Le nominatif");
    expect(result.key_points).toEqual(["Subject case", "Used with articles der/die/das"]);
  });

  it("accepts nullable fields", () => {
    const result = GrammarTopicSchema.parse({
      ...validTopic,
      title_source: null,
      key_points: null,
      examples: null,
      exercises: null,
    });
    expect(result.title_source).toBeNull();
    expect(result.key_points).toBeNull();
    expect(result.examples).toBeNull();
    expect(result.exercises).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 8. ExerciseSchema
// ─────────────────────────────────────────────────────────────────────
describe("ExerciseSchema", () => {
  it("accepts a QCM exercise", () => {
    const result = ExerciseSchema.parse({
      type: "qcm",
      question: "What is the article for Haus?",
      options: ["der", "die", "das", "dem"],
      correctIndex: 2,
    });
    expect(result.type).toBe("qcm");
    expect(result.options).toEqual(["der", "die", "das", "dem"]);
    expect(result.correctIndex).toBe(2);
  });

  it("accepts a fill exercise", () => {
    const result = ExerciseSchema.parse({
      type: "fill",
      sentence: "Ich ___ ein Buch.",
      answer: "lese",
      hint: "to read",
    });
    expect(result.type).toBe("fill");
    expect(result.answer).toBe("lese");
  });

  it("accepts a trueFalse exercise", () => {
    const result = ExerciseSchema.parse({
      type: "trueFalse",
      statement: "'Der Katze' is correct German.",
      isTrue: false,
      explanation: "It should be 'die Katze' (feminine).",
    });
    expect(result.type).toBe("trueFalse");
    expect(result.isTrue).toBe(false);
  });

  it("accepts a conjugation exercise", () => {
    const result = ExerciseSchema.parse({
      type: "conjugation",
      question: "Conjugate 'sein' in present tense for 'ich'",
      answer: "bin",
    });
    expect(result.type).toBe("conjugation");
  });

  it("rejects invalid exercise type", () => {
    expect(() =>
      ExerciseSchema.parse({
        type: "unknown",
        question: "test",
      }),
    ).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 9. VerbSchema
// ─────────────────────────────────────────────────────────────────────
describe("VerbSchema", () => {
  const validVerb = {
    id: 1,
    language_pair_id: 1,
    infinitive: "machen",
    translation: "faire",
    level: "A1",
    verb_type: "regular",
    auxiliary: "haben",
    is_separable: false,
    conjugations: {
      present: {
        ich: "mache",
        du: "machst",
        er: "macht",
        wir: "machen",
        ihr: "macht",
        sie: "machen",
      },
    },
    examples: [{ de: "Ich mache Hausaufgaben.", fr: "Je fais les devoirs." }],
  };

  it("accepts a valid verb", () => {
    const result = VerbSchema.parse(validVerb);
    expect(result.infinitive).toBe("machen");
    expect(result.translation).toBe("faire");
    expect(result.is_separable).toBe(false);
    expect(result.conjugations.present.ich).toBe("mache");
  });

  it("accepts verb with nullable fields", () => {
    const result = VerbSchema.parse({
      ...validVerb,
      level: null,
      verb_type: null,
      auxiliary: null,
      examples: null,
    });
    expect(result.level).toBeNull();
    expect(result.verb_type).toBeNull();
    expect(result.auxiliary).toBeNull();
    expect(result.examples).toBeNull();
  });

  it("accepts separable verb", () => {
    const result = VerbSchema.parse({
      ...validVerb,
      infinitive: "aufmachen",
      is_separable: true,
    });
    expect(result.is_separable).toBe(true);
  });

  it("accepts verb with multiple tenses", () => {
    const result = VerbSchema.parse({
      ...validVerb,
      conjugations: {
        present: { ich: "mache", du: "machst" },
        past: { ich: "machte", du: "machtest" },
        perfect: { ich: "habe gemacht", du: "hast gemacht" },
      },
    });
    expect(Object.keys(result.conjugations)).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 10. AiSettingsSchema
// ─────────────────────────────────────────────────────────────────────
describe("AiSettingsSchema", () => {
  it("accepts valid AI settings", () => {
    const result = AiSettingsSchema.parse({
      provider: "anthropic",
      api_key: "sk-ant-test",
      model: "claude-sonnet-4-6",
    });
    expect(result.provider).toBe("anthropic");
    expect(result.api_key).toBe("sk-ant-test");
    expect(result.model).toBe("claude-sonnet-4-6");
  });

  it("accepts empty api_key for local providers", () => {
    const result = AiSettingsSchema.parse({
      provider: "claude-code",
      api_key: "",
      model: "claude-sonnet-4-6",
    });
    expect(result.api_key).toBe("");
  });

  it("accepts empty model", () => {
    const result = AiSettingsSchema.parse({
      provider: "ollama",
      api_key: "",
      model: "",
    });
    expect(result.model).toBe("");
  });

  it("rejects missing provider", () => {
    expect(() =>
      AiSettingsSchema.parse({
        api_key: "",
        model: "",
      }),
    ).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// ConversationScenarioSchema
// ─────────────────────────────────────────────────────────────────────
describe("ConversationScenarioSchema", () => {
  it("parses a valid scenario", () => {
    const result = ConversationScenarioSchema.parse({
      id: 1,
      language_pair_id: 1,
      name: "At the Cafe",
      icon: "☕",
      description: "Order coffee in German",
      system_prompt: "You are a waiter",
      is_builtin: true,
      created_at: "2025-01-15",
    });
    expect(result.name).toBe("At the Cafe");
    expect(result.is_builtin).toBe(true);
  });

  it("coerces is_builtin from 1 to true", () => {
    const result = ConversationScenarioSchema.parse({
      id: 1,
      language_pair_id: 1,
      name: "Custom",
      icon: "📝",
      description: "Custom scenario",
      system_prompt: "test",
      is_builtin: 1,
      created_at: "2025-01-15",
    });
    expect(result.is_builtin).toBe(true);
  });

  it("coerces is_builtin from 0 to false", () => {
    const result = ConversationScenarioSchema.parse({
      id: 1,
      language_pair_id: 1,
      name: "Custom",
      icon: "📝",
      description: "Custom scenario",
      system_prompt: "test",
      is_builtin: 0,
      created_at: "2025-01-15",
    });
    expect(result.is_builtin).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// ConversationSessionSchema
// ─────────────────────────────────────────────────────────────────────
describe("ConversationSessionSchema", () => {
  it("parses a valid session", () => {
    const result = ConversationSessionSchema.parse({
      id: 1,
      language_pair_id: 1,
      scenario_id: 2,
      mode: "correct",
      title: "Cafe Practice",
      messages: "[]",
      created_at: "2025-01-15",
    });
    expect(result.mode).toBe("correct");
    expect(result.scenario_id).toBe(2);
  });

  it("accepts null scenario_id", () => {
    const result = ConversationSessionSchema.parse({
      id: 1,
      language_pair_id: 1,
      scenario_id: null,
      mode: "free",
      title: "Free Chat",
      messages: "[]",
      created_at: "2025-01-15",
    });
    expect(result.scenario_id).toBeNull();
  });

  it("rejects missing mode", () => {
    expect(() => ConversationSessionSchema.parse({
      id: 1,
      language_pair_id: 1,
      scenario_id: null,
      title: "Test",
      messages: "[]",
      created_at: "2025-01-15",
    })).toThrow();
  });
});
