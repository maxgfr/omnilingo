import { z } from "zod";

// ── Schemas ──────────────────────────────────────────────────────────

export const SettingsSchema = z.object({
  active_language_pair_id: z.number().nullable(),
  level: z.string().default("A1"),
  words_per_day: z.coerce.number().default(10),
  streak: z.coerce.number().default(0),
  last_session_date: z.string().nullable(),
  start_date: z.string().nullable(),
  dark_mode: z.string().default("system"),
  audio_enabled: z.preprocess((v) => v === true || v === 1 || v === "true" || v === "1", z.boolean()).default(true),
  ai_provider: z.string().default("claude-code"),
  ai_model: z.string().default(""),
});

export const LanguagePairSchema = z.object({
  id: z.number(),
  source_lang: z.string(),
  target_lang: z.string(),
  source_name: z.string(),
  target_name: z.string(),
  source_flag: z.string(),
  target_flag: z.string(),
  is_active: z.preprocess((v) => v === true || v === 1, z.boolean()),
});

export const WordSchema = z.object({
  id: z.number(),
  language_pair_id: z.number(),
  source_word: z.string(),
  target_word: z.string(),
  gender: z.string().nullable(),
  plural: z.string().nullable(),
  level: z.string().nullable(),
  category: z.string().nullable(),
  tags: z.string().nullable(),
  example_source: z.string().nullable(),
  example_target: z.string().nullable(),
});

export const SrsCardSchema = z.object({
  id: z.number(),
  word_id: z.number(),
  source_word: z.string(),
  target_word: z.string(),
  gender: z.string().nullable(),
  plural: z.string().nullable(),
  level: z.string().nullable(),
  category: z.string().nullable(),
  example_source: z.string().nullable(),
  example_target: z.string().nullable(),
  repetitions: z.number(),
  ease_factor: z.number(),
  interval_days: z.number(),
  next_review: z.string(),
  last_score: z.number().nullable(),
});

export const SrsStatsSchema = z.object({
  total_cards: z.number(),
  due_count: z.number(),
  average_accuracy: z.number(),
});

export const GrammarTopicSchema = z.object({
  id: z.string(),
  language_pair_id: z.number(),
  level: z.string(),
  display_order: z.number(),
  title: z.string(),
  title_source: z.string().nullable(),
  explanation: z.string(),
  key_points: z.array(z.string()).nullable(),
  examples: z.array(z.object({ source: z.string(), target: z.string(), highlight: z.string().optional() })).nullable(),
  exercises: z.array(z.any()).nullable(),
  completed: z.boolean(),
  score_correct: z.number(),
  score_total: z.number(),
});

export const ExerciseSchema = z.object({
  type: z.enum(["qcm", "fill", "trueFalse", "conjugation"]),
  question: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().optional(),
  sentence: z.string().optional(),
  answer: z.string().optional(),
  hint: z.string().optional(),
  statement: z.string().optional(),
  isTrue: z.boolean().optional(),
  explanation: z.string().optional(),
});

export const VerbSchema = z.object({
  id: z.number(),
  language_pair_id: z.number(),
  infinitive: z.string(),
  translation: z.string(),
  level: z.string().nullable(),
  verb_type: z.string().nullable(),
  auxiliary: z.string().nullable(),
  is_separable: z.boolean(),
  conjugations: z.record(z.string(), z.record(z.string(), z.string())),
  examples: z.array(z.object({ de: z.string(), fr: z.string() })).nullable(),
});

export const AiSettingsSchema = z.object({
  provider: z.string(),
  api_key: z.string(),
  model: z.string(),
});

export const WhisperModelInfoSchema = z.object({
  name: z.string(),
  size_mb: z.number(),
  url: z.string(),
  downloaded: z.boolean(),
});

export const DictionarySourceSchema = z.object({
  source_lang: z.string(),
  target_lang: z.string(),
  source_name: z.string(),
  target_name: z.string(),
  source_flag: z.string(),
  target_flag: z.string(),
  provider: z.string(),
  url: z.string(),
  format: z.string(),
  word_count: z.number().nullable(),
  size_mb: z.number().nullable(),
});

export const FavoriteWordSchema = z.object({
  id: z.number(),
  word_id: z.number(),
  source_word: z.string(),
  target_word: z.string(),
  gender: z.string().nullable(),
  level: z.string().nullable(),
  category: z.string().nullable(),
});

export const DailyStatRowSchema = z.object({
  date: z.string(),
  words_learned: z.number(),
  words_reviewed: z.number(),
  correct_count: z.number(),
  total_count: z.number(),
});

export const OverviewStatsSchema = z.object({
  total_words: z.number(),
  total_learned: z.number(),
  total_reviews: z.number(),
  total_grammar_completed: z.number(),
  total_grammar: z.number(),
  streak: z.number(),
  accuracy: z.number(),
  study_days: z.number(),
  favorite_count: z.number(),
});

// ── Inferred types ───────────────────────────────────────────────────

export type Settings = z.infer<typeof SettingsSchema>;
export type LanguagePair = z.infer<typeof LanguagePairSchema>;
export type Word = z.infer<typeof WordSchema>;
export type SrsCard = z.infer<typeof SrsCardSchema>;
export type SrsStats = z.infer<typeof SrsStatsSchema>;
export type GrammarTopic = z.infer<typeof GrammarTopicSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type Verb = z.infer<typeof VerbSchema>;
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export type WhisperModelInfo = z.infer<typeof WhisperModelInfoSchema>;
export type DictionarySource = z.infer<typeof DictionarySourceSchema>;
export type FavoriteWord = z.infer<typeof FavoriteWordSchema>;
export type DailyStatRow = z.infer<typeof DailyStatRowSchema>;
export type OverviewStats = z.infer<typeof OverviewStatsSchema>;
export type ViewName = "dashboard" | "learn" | "review" | "grammar" | "conjugation" | "dictionary" | "chat" | "settings" | "stats" | "quiz" | "flashcards" | "conversation" | "tools";
