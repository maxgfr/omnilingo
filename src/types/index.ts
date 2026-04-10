import { z } from "zod";

// ── Schemas ──────────────────────────────────────────────────────────

export const SettingsSchema = z.object({
  active_language_pair_id: z.number().nullable(),
  dark_mode: z.string().default("system"),
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

export const ConversationScenarioSchema = z.object({
  id: z.number(),
  language_pair_id: z.number(),
  name: z.string(),
  icon: z.string(),
  description: z.string(),
  system_prompt: z.string(),
  is_builtin: z.preprocess((v) => v === true || v === 1, z.boolean()),
  created_at: z.string(),
});

export const ConversationSessionSchema = z.object({
  id: z.number(),
  language_pair_id: z.number(),
  scenario_id: z.number().nullable(),
  mode: z.string(),
  title: z.string(),
  messages: z.string(),
  created_at: z.string(),
});

// ── Inferred types ───────────────────────────────────────────────────

export type Settings = z.infer<typeof SettingsSchema>;
export type LanguagePair = z.infer<typeof LanguagePairSchema>;
export type Word = z.infer<typeof WordSchema>;
export type GrammarTopic = z.infer<typeof GrammarTopicSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type Verb = z.infer<typeof VerbSchema>;
export type AiSettings = z.infer<typeof AiSettingsSchema>;
export type DictionarySource = z.infer<typeof DictionarySourceSchema>;
export type ConversationScenario = z.infer<typeof ConversationScenarioSchema>;
export type ConversationSession = z.infer<typeof ConversationSessionSchema>;
export type ViewName = "dictionary" | "grammar" | "conjugation" | "conversation" | "rephrase" | "corrector" | "synonyms" | "text-analysis" | "settings";
