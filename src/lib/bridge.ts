import { invoke } from "@tauri-apps/api/core";
import {
  SettingsSchema, LanguagePairSchema, WordSchema, SrsCardSchema,
  SrsStatsSchema, DeckInfoSchema, AiSettingsSchema, DictionarySourceSchema,
  FavoriteWordSchema, GrammarSrsStateSchema,
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
export const getWords = (pairId: number, level?: string, limit?: number, offset?: number) =>
  invokeAndParseArray("get_words", WordSchema, { pairId, level: level ?? null, limit: limit ?? null, offset: offset ?? null });
export const searchWords = (pairId: number, query: string, level?: string, category?: string, reversePairId?: number) =>
  invokeAndParseArray("search_words", WordSchema, { pairId, query, level: level ?? null, category: category ?? null, reversePairId: reversePairId ?? null });
export const getUnlearnedWords = (pairId: number, level?: string, limit?: number) =>
  invokeAndParseArray("get_unlearned_words", WordSchema, { pairId, level: level ?? null, limit: limit ?? null });
export const getWordCount = (pairId: number) => safeInvoke<number>("get_word_count", { pairId });
export const getCategories = (pairId: number) => safeInvoke<string[]>("get_categories", { pairId });
export const addCustomWord = (pairId: number, sourceWord: string, targetWord: string, gender?: string, level?: string, category?: string) =>
  safeInvoke<number>("add_custom_word", { pairId, sourceWord, targetWord, gender: gender ?? null, level: level ?? null, category: category ?? null });

// SRS
export const addWordToSrs = (wordId: number, deck?: string) =>
  invokeAndParse("add_word_to_srs", SrsCardSchema, { wordId, deck: deck ?? null });
export const getDueCards = (pairId: number, deck?: string) =>
  invokeAndParseArray("get_due_cards", SrsCardSchema, { pairId, deck: deck ?? null });
export const getAllSrsCards = (pairId: number, deck?: string) =>
  invokeAndParseArray("get_all_srs_cards", SrsCardSchema, { pairId, deck: deck ?? null });
export const getDueCount = (pairId: number) => safeInvoke<number>("get_due_count", { pairId });
export const reviewCard = (cardId: number, quality: number) => invokeAndParse("review_card", SrsCardSchema, { cardId, quality });
export const deleteSrsCard = (cardId: number) => safeInvoke<void>("delete_srs_card", { cardId });
export const getSrsStats = (pairId: number) => invokeAndParse("get_srs_stats", SrsStatsSchema, { pairId });
export const getDecks = (pairId: number) => invokeAndParseArray("get_decks", DeckInfoSchema, { pairId });
export const deleteDeck = (pairId: number, deck: string) => safeInvoke<void>("delete_deck", { pairId, deck });

// Grammar
export const getGrammarTopics = (pairId: number) => safeInvoke<GrammarTopic[]>("get_grammar_topics", { pairId });
export const markGrammarCompleted = (topicId: string, pairId: number, correct: number, total: number) =>
  safeInvoke<void>("mark_grammar_completed", { topicId, pairId, correct, total });
export const getDueGrammarTopics = (pairId: number) =>
  invokeAndParseArray("get_due_grammar_topics", GrammarSrsStateSchema, { pairId });
export const reviewGrammarTopic = (topicId: string, pairId: number, quality: number) =>
  invokeAndParse("review_grammar_topic", GrammarSrsStateSchema, { topicId, pairId, quality });

// Conjugation
export const getVerbs = (pairId: number, query?: string) => safeInvoke<Verb[]>("get_verbs", { pairId, query: query ?? null });
export const logConjugationSession = (pairId: number, verb: string, tense: string, correct: boolean, errors: string[]) =>
  safeInvoke<void>("log_conjugation_session", { pairId, verb, tense, correct, errors });

// Memory
export const readMemoryFile = (path: string) => safeInvoke<string | null>("read_memory_file", { path });
export const writeMemoryFile = (path: string, content: string) => safeInvoke<void>("write_memory_file", { path, content });

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

// Favorites
export const toggleFavorite = (wordId: number) => safeInvoke<boolean>("toggle_favorite", { wordId });
export const getFavorites = (pairId: number) => invokeAndParseArray("get_favorites", FavoriteWordSchema, { pairId });
export const isFavorite = (wordId: number) => safeInvoke<boolean>("is_favorite", { wordId });

// Export
export const exportData = () => safeInvoke<string>("export_data");

// Maintenance
export const clearCache = () => safeInvoke<string>("clear_cache");
export const resetProgress = () => safeInvoke<string>("reset_progress");
export const deleteAllData = () => safeInvoke<string>("delete_all_data");

// Ollama
export const detectOllama = () => safeInvoke<{ available: boolean; models: string[] }>("detect_ollama");

// Model catalog
export const fetchModelCatalog = () => safeInvoke<Record<string, string[]>>("fetch_model_catalog");
