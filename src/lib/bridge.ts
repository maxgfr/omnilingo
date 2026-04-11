import { invoke } from "@tauri-apps/api/core";
import {
  SettingsSchema, LanguagePairSchema,
  AiSettingsSchema, DictionaryEntrySchema,
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
export const createLanguagePair = (
  sourceLang: string, sourceName: string, sourceFlag: string,
  targetLang: string, targetName: string, targetFlag: string,
) => safeInvoke<number>("create_language_pair", {
  sourceLang, sourceName, sourceFlag, targetLang, targetName, targetFlag,
});
export const deleteLanguagePair = (pairId: number) => safeInvoke<void>("delete_language_pair", { pairId });

// Grammar
export const getGrammarTopics = (pairId: number) => safeInvoke<GrammarTopic[]>("get_grammar_topics", { pairId });
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
export const saveVerb = (
  pairId: number,
  infinitive: string,
  translation: string,
  level: string | null,
  verbType: string | null,
  auxiliary: string | null,
  isSeparable: boolean,
  conjugations: unknown,
  examples: unknown | null,
) =>
  safeInvoke<number>("save_verb", {
    input: {
      pair_id: pairId,
      infinitive,
      translation,
      level,
      verb_type: verbType,
      auxiliary,
      is_separable: isSeparable,
      conjugations,
      examples,
    },
  });

export const getVerbs = (pairId: number) => safeInvoke<Verb[]>("get_verbs", { pairId });
export const deleteVerb = (verbId: number, pairId: number) =>
  safeInvoke<void>("delete_verb", { verbId, pairId });

// Dictionary (saved AI lookups)
export const saveDictionaryEntry = (pairId: number, query: string, content: string) =>
  safeInvoke<number>("save_dictionary_entry", { pairId, query, content });
export const getDictionaryEntries = (pairId: number) =>
  invokeAndParseArray("get_dictionary_entries", DictionaryEntrySchema, { pairId });
export const deleteDictionaryEntry = (entryId: number, pairId: number) =>
  safeInvoke<void>("delete_dictionary_entry", { entryId, pairId });


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
export const updateConversationSessionTitle = (sessionId: number, title: string) =>
  safeInvoke<void>("update_conversation_session_title", { sessionId, title });

// Session
export const logSession = (pairId: number, sessionType: string, sessionData: Record<string, unknown>) =>
  safeInvoke<void>("log_session", { pairId, sessionType, sessionData });

// Maintenance
export const deleteAllData = () => safeInvoke<string>("delete_all_data");

// Model catalog
export const fetchModelCatalog = () => safeInvoke<Record<string, string[]>>("fetch_model_catalog");
