import { describe, it, expect } from "vitest";
import {
  SettingsSchema,
  LanguagePairSchema,
  WordSchema,
  SrsCardSchema,
  SrsStatsSchema,
  DictionarySourceSchema,
  DailyStatRowSchema,
  GrammarTopicSchema,
  ExerciseSchema,
  VerbSchema,
  AiSettingsSchema,
  WhisperModelInfoSchema,
  FavoriteWordSchema,
  OverviewStatsSchema,
} from "../types";

// ─────────────────────────────────────────────────────────────────────
// 1. SettingsSchema
// ─────────────────────────────────────────────────────────────────────
describe("SettingsSchema", () => {
  const validSettings = {
    active_language_pair_id: 1,
    level: "A2",
    words_per_day: 10,
    streak: 0,
    last_session_date: null,
    start_date: null,
    dark_mode: "system",
    audio_enabled: true,
    ai_provider: "claude-code",
    ai_model: "",
  };

  it("accepts fully valid settings", () => {
    const result = SettingsSchema.parse(validSettings);
    expect(result.active_language_pair_id).toBe(1);
    expect(result.level).toBe("A2");
    expect(result.words_per_day).toBe(10);
    expect(result.streak).toBe(0);
    expect(result.last_session_date).toBeNull();
    expect(result.start_date).toBeNull();
    expect(result.dark_mode).toBe("system");
    expect(result.audio_enabled).toBe(true);
    expect(result.ai_provider).toBe("claude-code");
    expect(result.ai_model).toBe("");
  });

  it("applies defaults for missing optional fields", () => {
    const result = SettingsSchema.parse({
      active_language_pair_id: null,
      last_session_date: null,
      start_date: null,
    });
    expect(result.level).toBe("A1");
    expect(result.words_per_day).toBe(10);
    expect(result.streak).toBe(0);
    expect(result.dark_mode).toBe("system");
    expect(result.audio_enabled).toBe(true);
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

  it("coerces audio_enabled from integer 1 to true", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      audio_enabled: 1,
    });
    expect(result.audio_enabled).toBe(true);
  });

  it("coerces audio_enabled from integer 0 to false", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      audio_enabled: 0,
    });
    expect(result.audio_enabled).toBe(false);
  });

  it("coerces audio_enabled from string 'true' to true", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      audio_enabled: "true",
    });
    expect(result.audio_enabled).toBe(true);
  });

  it("coerces audio_enabled from string '1' to true", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      audio_enabled: "1",
    });
    expect(result.audio_enabled).toBe(true);
  });

  it("coerces audio_enabled from string 'false' to false", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      audio_enabled: "false",
    });
    expect(result.audio_enabled).toBe(false);
  });

  it("coerces audio_enabled from boolean false to false", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      audio_enabled: false,
    });
    expect(result.audio_enabled).toBe(false);
  });

  it("coerces audio_enabled from boolean true to true", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      audio_enabled: true,
    });
    expect(result.audio_enabled).toBe(true);
  });

  it("coerces words_per_day from string to number", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      words_per_day: "20",
    });
    expect(result.words_per_day).toBe(20);
  });

  it("coerces streak from string to number", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      streak: "5",
    });
    expect(result.streak).toBe(5);
  });

  it("accepts non-null last_session_date", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      last_session_date: "2026-03-18",
    });
    expect(result.last_session_date).toBe("2026-03-18");
  });

  it("accepts non-null start_date", () => {
    const result = SettingsSchema.parse({
      ...validSettings,
      start_date: "2026-01-01",
    });
    expect(result.start_date).toBe("2026-01-01");
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

  it("handles combined legacy values from backend", () => {
    // Simulates a backend sending legacy integer/string values
    const result = SettingsSchema.parse({
      active_language_pair_id: 1,
      level: "A2",
      words_per_day: "10",
      streak: "3",
      last_session_date: null,
      start_date: null,
      dark_mode: "dark",
      audio_enabled: 1,
      ai_provider: "claude-code",
      ai_model: "",
    });
    expect(result.words_per_day).toBe(10);
    expect(result.streak).toBe(3);
    expect(result.audio_enabled).toBe(true);
    expect(result.dark_mode).toBe("dark");
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
// 3. WordSchema
// ─────────────────────────────────────────────────────────────────────
describe("WordSchema", () => {
  const validWord = {
    id: 42,
    language_pair_id: 1,
    source_word: "Haus",
    target_word: "maison",
    gender: "n",
    plural: "Hauser",
    level: "A1",
    category: "home",
    tags: "basic,house",
    example_source: "Das ist mein Haus.",
    example_target: "C'est ma maison.",
  };

  it("accepts a fully valid word", () => {
    const result = WordSchema.parse(validWord);
    expect(result.id).toBe(42);
    expect(result.source_word).toBe("Haus");
    expect(result.target_word).toBe("maison");
    expect(result.gender).toBe("n");
    expect(result.level).toBe("A1");
    expect(result.category).toBe("home");
    expect(result.tags).toBe("basic,house");
    expect(result.example_source).toBe("Das ist mein Haus.");
    expect(result.example_target).toBe("C'est ma maison.");
  });

  it("accepts all nullable fields as null", () => {
    const result = WordSchema.parse({
      id: 1,
      language_pair_id: 1,
      source_word: "hello",
      target_word: "bonjour",
      gender: null,
      plural: null,
      level: null,
      category: null,
      tags: null,
      example_source: null,
      example_target: null,
    });
    expect(result.gender).toBeNull();
    expect(result.plural).toBeNull();
    expect(result.level).toBeNull();
    expect(result.category).toBeNull();
    expect(result.tags).toBeNull();
    expect(result.example_source).toBeNull();
    expect(result.example_target).toBeNull();
  });

  it("rejects missing required fields", () => {
    expect(() => WordSchema.parse({ id: 1 })).toThrow();
    expect(() =>
      WordSchema.parse({
        id: 1,
        language_pair_id: 1,
        source_word: "hello",
        // missing target_word
      }),
    ).toThrow();
  });

  it("accepts word with only required fields and nulls", () => {
    const result = WordSchema.parse({
      id: 100,
      language_pair_id: 2,
      source_word: "Katze",
      target_word: "chat",
      gender: null,
      plural: null,
      level: null,
      category: null,
      tags: null,
      example_source: null,
      example_target: null,
    });
    expect(result.id).toBe(100);
    expect(result.source_word).toBe("Katze");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4. SrsCardSchema
// ─────────────────────────────────────────────────────────────────────
describe("SrsCardSchema", () => {
  const validCard = {
    id: 1,
    word_id: 42,
    source_word: "Haus",
    target_word: "maison",
    gender: "n",
    plural: "Hauser",
    level: "A1",
    category: "home",
    example_source: "Das ist mein Haus.",
    example_target: "C'est ma maison.",
    repetitions: 3,
    ease_factor: 2.5,
    interval_days: 7,
    next_review: "2026-03-25",
    last_score: 4,
  };

  it("accepts a fully valid SRS card", () => {
    const result = SrsCardSchema.parse(validCard);
    expect(result.id).toBe(1);
    expect(result.word_id).toBe(42);
    expect(result.source_word).toBe("Haus");
    expect(result.target_word).toBe("maison");
    expect(result.repetitions).toBe(3);
    expect(result.ease_factor).toBe(2.5);
    expect(result.interval_days).toBe(7);
    expect(result.next_review).toBe("2026-03-25");
    expect(result.last_score).toBe(4);
  });

  it("accepts nullable fields on SRS card", () => {
    const result = SrsCardSchema.parse({
      ...validCard,
      gender: null,
      plural: null,
      level: null,
      category: null,
      example_source: null,
      example_target: null,
      last_score: null,
    });
    expect(result.gender).toBeNull();
    expect(result.plural).toBeNull();
    expect(result.level).toBeNull();
    expect(result.category).toBeNull();
    expect(result.example_source).toBeNull();
    expect(result.example_target).toBeNull();
    expect(result.last_score).toBeNull();
  });

  it("accepts new card with default SM-2 values", () => {
    const result = SrsCardSchema.parse({
      ...validCard,
      repetitions: 0,
      ease_factor: 2.5,
      interval_days: 0,
      last_score: null,
    });
    expect(result.repetitions).toBe(0);
    expect(result.ease_factor).toBe(2.5);
    expect(result.interval_days).toBe(0);
    expect(result.last_score).toBeNull();
  });

  it("accepts card with high repetition count", () => {
    const result = SrsCardSchema.parse({
      ...validCard,
      repetitions: 100,
      ease_factor: 3.5,
      interval_days: 365,
    });
    expect(result.repetitions).toBe(100);
    expect(result.interval_days).toBe(365);
  });

  it("rejects missing next_review", () => {
    const { next_review: _, ...noReview } = validCard;
    expect(() => SrsCardSchema.parse(noReview)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5. SrsStatsSchema
// ─────────────────────────────────────────────────────────────────────
describe("SrsStatsSchema", () => {
  it("accepts valid SRS stats", () => {
    const result = SrsStatsSchema.parse({
      total_cards: 150,
      due_count: 12,
      average_accuracy: 87.5,
    });
    expect(result.total_cards).toBe(150);
    expect(result.due_count).toBe(12);
    expect(result.average_accuracy).toBe(87.5);
  });

  it("accepts zero values", () => {
    const result = SrsStatsSchema.parse({
      total_cards: 0,
      due_count: 0,
      average_accuracy: 0,
    });
    expect(result.total_cards).toBe(0);
    expect(result.due_count).toBe(0);
    expect(result.average_accuracy).toBe(0);
  });

  it("accepts 100% accuracy", () => {
    const result = SrsStatsSchema.parse({
      total_cards: 50,
      due_count: 0,
      average_accuracy: 100,
    });
    expect(result.average_accuracy).toBe(100);
  });

  it("rejects missing fields", () => {
    expect(() => SrsStatsSchema.parse({ total_cards: 10 })).toThrow();
    expect(() => SrsStatsSchema.parse({})).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 6. DictionarySourceSchema
// ─────────────────────────────────────────────────────────────────────
describe("DictionarySourceSchema", () => {
  const validSource = {
    source_lang: "deu",
    target_lang: "fra",
    source_name: "German",
    target_name: "French",
    source_flag: "\uD83C\uDDE9\uD83C\uDDEA",
    target_flag: "\uD83C\uDDEB\uD83C\uDDF7",
    provider: "freedict",
    url: "https://example.com/dict.tar.gz",
    format: "stardict",
    word_count: 1000,
    size_mb: 1.5,
  };

  it("accepts a fully valid dictionary source", () => {
    const result = DictionarySourceSchema.parse(validSource);
    expect(result.source_lang).toBe("deu");
    expect(result.target_lang).toBe("fra");
    expect(result.provider).toBe("freedict");
    expect(result.url).toBe("https://example.com/dict.tar.gz");
    expect(result.format).toBe("stardict");
    expect(result.word_count).toBe(1000);
    expect(result.size_mb).toBe(1.5);
  });

  it("accepts nullable word_count", () => {
    const result = DictionarySourceSchema.parse({
      ...validSource,
      word_count: null,
    });
    expect(result.word_count).toBeNull();
  });

  it("accepts nullable size_mb", () => {
    const result = DictionarySourceSchema.parse({
      ...validSource,
      size_mb: null,
    });
    expect(result.size_mb).toBeNull();
  });

  it("accepts both word_count and size_mb as null", () => {
    const result = DictionarySourceSchema.parse({
      ...validSource,
      word_count: null,
      size_mb: null,
    });
    expect(result.word_count).toBeNull();
    expect(result.size_mb).toBeNull();
  });

  it("rejects missing provider", () => {
    const { provider: _, ...noProvider } = validSource;
    expect(() => DictionarySourceSchema.parse(noProvider)).toThrow();
  });

  it("rejects missing url", () => {
    const { url: _, ...noUrl } = validSource;
    expect(() => DictionarySourceSchema.parse(noUrl)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 7. DailyStatRowSchema
// ─────────────────────────────────────────────────────────────────────
describe("DailyStatRowSchema", () => {
  it("accepts a valid daily stat row", () => {
    const result = DailyStatRowSchema.parse({
      date: "2026-03-18",
      words_learned: 10,
      words_reviewed: 25,
      correct_count: 22,
      total_count: 25,
    });
    expect(result.date).toBe("2026-03-18");
    expect(result.words_learned).toBe(10);
    expect(result.words_reviewed).toBe(25);
    expect(result.correct_count).toBe(22);
    expect(result.total_count).toBe(25);
  });

  it("accepts zero values for a day with no activity", () => {
    const result = DailyStatRowSchema.parse({
      date: "2026-03-17",
      words_learned: 0,
      words_reviewed: 0,
      correct_count: 0,
      total_count: 0,
    });
    expect(result.words_learned).toBe(0);
    expect(result.words_reviewed).toBe(0);
  });

  it("rejects missing date", () => {
    expect(() =>
      DailyStatRowSchema.parse({
        words_learned: 5,
        words_reviewed: 10,
        correct_count: 8,
        total_count: 10,
      }),
    ).toThrow();
  });

  it("rejects missing numeric fields", () => {
    expect(() =>
      DailyStatRowSchema.parse({
        date: "2026-03-18",
      }),
    ).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 8. GrammarTopicSchema
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
    completed: false,
    score_correct: 0,
    score_total: 0,
  };

  it("accepts a valid grammar topic", () => {
    const result = GrammarTopicSchema.parse(validTopic);
    expect(result.id).toBe("nominativ");
    expect(result.title).toBe("Le nominatif");
    expect(result.completed).toBe(false);
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

  it("accepts completed topic with scores", () => {
    const result = GrammarTopicSchema.parse({
      ...validTopic,
      completed: true,
      score_correct: 8,
      score_total: 10,
    });
    expect(result.completed).toBe(true);
    expect(result.score_correct).toBe(8);
    expect(result.score_total).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 9. ExerciseSchema
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
// 10. VerbSchema
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
// 11. AiSettingsSchema
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
// 12. WhisperModelInfoSchema
// ─────────────────────────────────────────────────────────────────────
describe("WhisperModelInfoSchema", () => {
  it("accepts a valid whisper model info", () => {
    const result = WhisperModelInfoSchema.parse({
      name: "base",
      size_mb: 141,
      url: "https://example.com/base.bin",
      downloaded: false,
    });
    expect(result.name).toBe("base");
    expect(result.size_mb).toBe(141);
    expect(result.downloaded).toBe(false);
  });

  it("accepts downloaded model", () => {
    const result = WhisperModelInfoSchema.parse({
      name: "small",
      size_mb: 461,
      url: "https://example.com/small.bin",
      downloaded: true,
    });
    expect(result.downloaded).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 13. FavoriteWordSchema
// ─────────────────────────────────────────────────────────────────────
describe("FavoriteWordSchema", () => {
  it("accepts a valid favorite word", () => {
    const result = FavoriteWordSchema.parse({
      id: 1,
      word_id: 42,
      source_word: "Haus",
      target_word: "maison",
      gender: "n",
      level: "A1",
      category: "home",
    });
    expect(result.id).toBe(1);
    expect(result.word_id).toBe(42);
    expect(result.source_word).toBe("Haus");
  });

  it("accepts nullable fields", () => {
    const result = FavoriteWordSchema.parse({
      id: 1,
      word_id: 42,
      source_word: "hello",
      target_word: "bonjour",
      gender: null,
      level: null,
      category: null,
    });
    expect(result.gender).toBeNull();
    expect(result.level).toBeNull();
    expect(result.category).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 14. OverviewStatsSchema
// ─────────────────────────────────────────────────────────────────────
describe("OverviewStatsSchema", () => {
  it("accepts valid overview stats", () => {
    const result = OverviewStatsSchema.parse({
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
    expect(result.total_words).toBe(500);
    expect(result.total_learned).toBe(200);
    expect(result.total_reviews).toBe(1500);
    expect(result.streak).toBe(7);
    expect(result.accuracy).toBe(85.5);
    expect(result.study_days).toBe(30);
    expect(result.favorite_count).toBe(15);
  });

  it("accepts all-zero overview stats for new user", () => {
    const result = OverviewStatsSchema.parse({
      total_words: 0,
      total_learned: 0,
      total_reviews: 0,
      total_grammar_completed: 0,
      total_grammar: 0,
      streak: 0,
      accuracy: 0,
      study_days: 0,
      favorite_count: 0,
    });
    expect(result.total_words).toBe(0);
    expect(result.accuracy).toBe(0);
  });

  it("rejects missing fields", () => {
    expect(() =>
      OverviewStatsSchema.parse({
        total_words: 100,
      }),
    ).toThrow();
  });
});
