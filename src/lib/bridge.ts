import { invoke } from "@tauri-apps/api/core";
import {
  SettingsSchema, LanguagePairSchema, WordSchema,
  AiSettingsSchema, DictionarySourceSchema,
  GrammarSrsStateSchema,
  ConversationScenarioSchema, ConversationSessionSchema,
} from "../types";
import type { GrammarTopic, Verb } from "../types";
import { z } from "zod";

// Centralized error wrapper for IPC calls
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`IPC call "${cmd}" failed: ${message}`);
  }
}

// Helper: invoke + parse with Zod schema
async function invokeAndParse<T>(cmd: string, schema: z.ZodType<T>, args?: Record<string, unknown>): Promise<T> {
  const raw = await safeInvoke(cmd, args);
  return schema.parse(raw);
}

async function invokeAndParseArray<T>(cmd: string, schema: z.ZodType<T>, args?: Record<string, unknown>): Promise<T[]> {
  const raw = await safeInvoke<unknown[]>(cmd, args);
  return z.array(schema).parse(raw);
}

// Settings
export const getSettings = () => invokeAndParse("get_settings", SettingsSchema);
export const updateSetting = (key: string, value: string) => safeInvoke<void>("update_setting", { key, value });
export const getLanguagePairs = () => invokeAndParseArray("get_language_pairs", LanguagePairSchema);
export const setActiveLanguagePair = (pairId: number) => safeInvoke<void>("set_active_language_pair", { pairId });
export const deleteLanguagePair = (pairId: number) => safeInvoke<void>("delete_language_pair", { pairId });

// Dictionary
export const searchWords = (pairId: number, query: string, level?: string, category?: string, reversePairId?: number) =>
  invokeAndParseArray("search_words", WordSchema, { pairId, query, level: level ?? null, category: category ?? null, reversePairId: reversePairId ?? null });
export const getAllDictionaryWords = (pairId: number, reversePairId?: number) =>
  invokeAndParseArray("get_all_dictionary_words", WordSchema, { pairId, reversePairId: reversePairId ?? null });

// Grammar
export const getGrammarTopics = (pairId: number) => safeInvoke<GrammarTopic[]>("get_grammar_topics", { pairId });
export const markGrammarCompleted = (topicId: string, pairId: number, correct: number, total: number) =>
  safeInvoke<void>("mark_grammar_completed", { topicId, pairId, correct, total });
export const getDueGrammarTopics = (pairId: number) =>
  invokeAndParseArray("get_due_grammar_topics", GrammarSrsStateSchema, { pairId });
export const reviewGrammarTopic = (topicId: string, pairId: number, quality: number) =>
  invokeAndParse("review_grammar_topic", GrammarSrsStateSchema, { topicId, pairId, quality });
export const saveGrammarTopic = (input: {
  pairId: number; level: string; title: string; titleSource?: string;
  explanation: string; keyPoints?: unknown; examples?: unknown; exercises?: unknown;
}) => safeInvoke<string>("save_grammar_topic", {
  input: {
    pair_id: input.pairId, level: input.level, title: input.title,
    title_source: input.titleSource ?? null, explanation: input.explanation,
    key_points: input.keyPoints ?? null, examples: input.examples ?? null,
    exercises: input.exercises ?? null,
  },
});
export const deleteGrammarTopic = (topicId: string, pairId: number) =>
  safeInvoke<void>("delete_grammar_topic", { topicId, pairId });

// Conjugation
export const getVerbs = (pairId: number, query?: string) => safeInvoke<Verb[]>("get_verbs", { pairId, query: query ?? null });
export const saveVerb = (pairId: number, infinitive: string, translation: string, level: string | null, verbType: string | null, auxiliary: string | null, isSeparable: boolean, conjugations: unknown, examples: unknown | null) =>
  safeInvoke<number>("save_verb", {
    input: {
      pair_id: pairId, infinitive, translation, level,
      verb_type: verbType, auxiliary, is_separable: isSeparable,
      conjugations, examples,
    },
  });
export const deleteVerb = (verbId: number) =>
  safeInvoke<void>("delete_verb", { verbId });
export const getConjugationStats = (pairId: number) =>
  safeInvoke<{ total_sessions: number; by_tense: Array<{ tense: string; correct: number; total: number }>; by_verb: Array<{ verb: string; correct: number; total: number }> }>("get_conjugation_stats", { pairId });
export const logConjugationSession = (pairId: number, verb: string, tense: string, correct: boolean, errors: string[]) =>
  safeInvoke<void>("log_conjugation_session", { pairId, verb, tense, correct, errors });

// Memory
export const readMemoryFile = (path: string) => safeInvoke<string | null>("read_memory_file", { path });

// AI
export const askAi = (prompt: string) => safeInvoke<string>("ask_ai", { prompt });
export const askAiConversation = (messages: Array<{ role: string; content: string }>) =>
  safeInvoke<string>("ask_ai_conversation", { messages });
export const getAiSettings = () => invokeAndParse("get_ai_settings_cmd", AiSettingsSchema);
export const setAiProvider = (provider: string, apiKey: string, model: string) =>
  safeInvoke<void>("set_ai_provider", { provider, apiKey, model });
export const testAiConnection = (provider: string, apiKey: string, model: string, customUrl?: string) =>
  safeInvoke<string>("test_ai_connection", { provider, apiKey, model, customUrl: customUrl ?? null });
export const setAiCustomUrl = (url: string) =>
  safeInvoke<void>("set_ai_custom_url", { url });
export const generateVocabulary = (pairId: number, count: number, level: string, theme?: string) =>
  safeInvoke<number>("generate_vocabulary", { pairId, count, level, theme: theme ?? null });
export const generateGrammar = (pairId: number, count: number, level: string) =>
  safeInvoke<number>("generate_grammar", { pairId, count, level });
export const generateVerbs = (pairId: number, count: number, level: string) =>
  safeInvoke<number>("generate_verbs", { pairId, count, level });

// Chat persistence
export const getChatHistory = (pairId: number, limit?: number) =>
  safeInvoke<Array<{ id: number; role: string; content: string; created_at: string }>>("get_chat_history", { pairId, limit: limit ?? null });
export const saveChatMessage = (pairId: number, role: string, content: string) =>
  safeInvoke<number>("save_chat_message", { pairId, role, content });
export const clearChatHistory = (pairId: number) =>
  safeInvoke<void>("clear_chat_history", { pairId });

// Conversation scenarios & sessions
export const getConversationScenarios = (pairId: number) =>
  invokeAndParseArray("get_conversation_scenarios", ConversationScenarioSchema, { pairId });
export const saveConversationScenario = (pairId: number, name: string, icon: string, description: string, systemPrompt: string) =>
  safeInvoke<number>("save_conversation_scenario", { pairId, name, icon, description, systemPrompt });
export const updateConversationScenario = (scenarioId: number, name: string, icon: string, description: string, systemPrompt: string) =>
  safeInvoke<void>("update_conversation_scenario", { scenarioId, name, icon, description, systemPrompt });
export const deleteConversationScenario = (scenarioId: number) =>
  safeInvoke<void>("delete_conversation_scenario", { scenarioId });
export const getConversationSessions = (pairId: number, limit?: number) =>
  invokeAndParseArray("get_conversation_sessions", ConversationSessionSchema, { pairId, limit: limit ?? null });
export const saveConversationSession = (pairId: number, scenarioId: number | null, mode: string, title: string, messages: string) =>
  safeInvoke<number>("save_conversation_session", { pairId, scenarioId, mode, title, messages });
export const deleteConversationSession = (sessionId: number) =>
  safeInvoke<void>("delete_conversation_session", { sessionId });

// Session
export const logSession = (pairId: number, sessionType: string, sessionData: Record<string, unknown>) =>
  safeInvoke<void>("log_session", { pairId, sessionType, sessionData });

// Import
export const importBuiltinData = (pairId: number) => safeInvoke<string>("import_builtin_data", { pairId });
export const importFromFile = (pairId: number, content: string, format: string) =>
  safeInvoke<string>("import_from_file", { pairId, content, format });

// Download
export const getAvailableDictionaries = () => invokeAndParseArray("get_available_dictionaries", DictionarySourceSchema);
export const downloadDictionary = (sourceLang: string, targetLang: string, url: string, sourceName: string, targetName: string, format: string) =>
  safeInvoke<string>("download_dictionary", { sourceLang, targetLang, url, sourceName, targetName, format });

// Export
export const exportData = () => safeInvoke<string>("export_data");

// Maintenance
export const deleteAllData = () => safeInvoke<string>("delete_all_data");

// Model catalog
export const fetchModelCatalog = () => safeInvoke<Record<string, string[]>>("fetch_model_catalog");
