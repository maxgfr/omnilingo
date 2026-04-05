import { invoke } from "@tauri-apps/api/core";
import {
  SettingsSchema, LanguagePairSchema, WordSchema, SrsCardSchema,
  SrsStatsSchema, AiSettingsSchema, DictionarySourceSchema,
  FavoriteWordSchema, DailyStatRowSchema, OverviewStatsSchema,
} from "../types";
import type {
  Word, GrammarTopic, Verb, WhisperModelInfo,
} from "../types";
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
export const updateStreak = () => invokeAndParse("update_streak", SettingsSchema);

// Dictionary
export const getWords = (pairId: number, level?: string, limit?: number, offset?: number) =>
  invokeAndParseArray("get_words", WordSchema, { pairId, level: level ?? null, limit: limit ?? null, offset: offset ?? null });
export const searchWords = (pairId: number, query: string, level?: string, category?: string) =>
  invokeAndParseArray("search_words", WordSchema, { pairId, query, level: level ?? null, category: category ?? null });
export const getUnlearnedWords = (pairId: number, level?: string, limit?: number) =>
  invokeAndParseArray("get_unlearned_words", WordSchema, { pairId, level: level ?? null, limit: limit ?? null });
export const getWordCount = (pairId: number) => safeInvoke<number>("get_word_count", { pairId });
export const getCategories = (pairId: number) => safeInvoke<string[]>("get_categories", { pairId });

// SRS
export const addWordToSrs = (wordId: number) => invokeAndParse("add_word_to_srs", SrsCardSchema, { wordId });
export const getDueCards = (pairId: number) => invokeAndParseArray("get_due_cards", SrsCardSchema, { pairId });
export const getDueCount = (pairId: number) => safeInvoke<number>("get_due_count", { pairId });
export const reviewCard = (cardId: number, quality: number) => invokeAndParse("review_card", SrsCardSchema, { cardId, quality });
export const getSrsStats = (pairId: number) => invokeAndParse("get_srs_stats", SrsStatsSchema, { pairId });

// Grammar
export const getGrammarTopics = (pairId: number) => safeInvoke<GrammarTopic[]>("get_grammar_topics", { pairId });
export const markGrammarCompleted = (topicId: string, pairId: number, correct: number, total: number) =>
  safeInvoke<void>("mark_grammar_completed", { topicId, pairId, correct, total });

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

// Session
export const logSession = (pairId: number, sessionType: string, sessionData: Record<string, unknown>) =>
  safeInvoke<void>("log_session", { pairId, sessionType, sessionData });

// Import
export const importBuiltinData = (pairId: number) => safeInvoke<string>("import_builtin_data", { pairId });
export const importFromFile = (pairId: number, content: string, format: string) =>
  safeInvoke<string>("import_from_file", { pairId, content, format });

// Speech
export const getWhisperModels = () => safeInvoke<WhisperModelInfo[]>("get_whisper_models");
export const downloadWhisperModel = (modelName: string) => safeInvoke<string>("download_whisper_model", { modelName });
export const deleteWhisperModel = (modelName: string) => safeInvoke<string>("delete_whisper_model", { modelName });
export const transcribeAudio = (audioData: number[], language?: string) =>
  safeInvoke<string>("transcribe_audio", { audioData, language: language ?? null });

// Download
export const getAvailableDictionaries = () => invokeAndParseArray("get_available_dictionaries", DictionarySourceSchema);
export const downloadDictionary = (sourceLang: string, targetLang: string, url: string, sourceName: string, targetName: string, format: string) =>
  safeInvoke<string>("download_dictionary", { sourceLang, targetLang, url, sourceName, targetName, format });

// Favorites
export const toggleFavorite = (wordId: number) => safeInvoke<boolean>("toggle_favorite", { wordId });
export const getFavorites = (pairId: number) => invokeAndParseArray("get_favorites", FavoriteWordSchema, { pairId });
export const isFavorite = (wordId: number) => safeInvoke<boolean>("is_favorite", { wordId });

// Stats
export const getDailyStats = (pairId: number, days: number) => invokeAndParseArray("get_daily_stats", DailyStatRowSchema, { pairId, days });
export const getOverviewStats = (pairId: number) => invokeAndParse("get_overview_stats", OverviewStatsSchema, { pairId });
export const logError = (pairId: number, errorType: string, wordOrTopic: string, userAnswer: string, correctAnswer: string) =>
  safeInvoke<void>("log_error", { pairId, errorType, wordOrTopic, userAnswer, correctAnswer });
export const getFrequentErrors = (pairId: number, limit?: number) =>
  safeInvoke<Array<{ word: string; type: string; count: number; correct: string }>>("get_frequent_errors", { pairId, limit: limit ?? null });
export const addCustomWord = (pairId: number, sourceWord: string, targetWord: string, gender?: string, level?: string, category?: string) =>
  safeInvoke<number>("add_custom_word", { pairId, sourceWord, targetWord, gender: gender ?? null, level: level ?? null, category: category ?? null });
export const getRandomWord = (pairId: number) => safeInvoke<Word | null>("get_random_word", { pairId });

// Export/Import
export const exportProgress = (pairId: number) => safeInvoke<Record<string, unknown>>("export_progress", { pairId });
export const importProgress = (pairId: number, data: Record<string, unknown>) => safeInvoke<string>("import_progress", { pairId, data });

// Maintenance
export const clearCache = () => safeInvoke<string>("clear_cache");
export const resetProgress = () => safeInvoke<string>("reset_progress");

// Ollama
export const detectOllama = () => safeInvoke<{ available: boolean; models: string[] }>("detect_ollama");

// Model catalog
export const fetchModelCatalog = () => safeInvoke<Record<string, string[]>>("fetch_model_catalog");
