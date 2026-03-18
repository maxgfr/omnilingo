import { invoke } from "@tauri-apps/api/core";
import type { Settings, LanguagePair, Word, SrsCard, SrsStats, GrammarTopic, Verb, AiSettings, WhisperModelInfo, DictionarySource, FavoriteWord, DailyStatRow, OverviewStats } from "../types";

// Settings
export const getSettings = () => invoke<Settings>("get_settings");
export const updateSetting = (key: string, value: string) => invoke<void>("update_setting", { key, value });
export const getLanguagePairs = () => invoke<LanguagePair[]>("get_language_pairs");
export const setActiveLanguagePair = (pairId: number) => invoke<void>("set_active_language_pair", { pairId });
export const updateStreak = () => invoke<Settings>("update_streak");

// Dictionary
export const getWords = (pairId: number, level?: string, limit?: number, offset?: number) =>
  invoke<Word[]>("get_words", { pairId, level: level ?? null, limit: limit ?? null, offset: offset ?? null });
export const searchWords = (pairId: number, query: string, level?: string, category?: string) =>
  invoke<Word[]>("search_words", { pairId, query, level: level ?? null, category: category ?? null });
export const getUnlearnedWords = (pairId: number, level?: string, limit?: number) =>
  invoke<Word[]>("get_unlearned_words", { pairId, level: level ?? null, limit: limit ?? null });
export const getWordCount = (pairId: number) => invoke<number>("get_word_count", { pairId });
export const getCategories = (pairId: number) => invoke<string[]>("get_categories", { pairId });

// SRS
export const addWordToSrs = (wordId: number) => invoke<SrsCard>("add_word_to_srs", { wordId });
export const getDueCards = (pairId: number) => invoke<SrsCard[]>("get_due_cards", { pairId });
export const getDueCount = (pairId: number) => invoke<number>("get_due_count", { pairId });
export const reviewCard = (cardId: number, quality: number) => invoke<SrsCard>("review_card", { cardId, quality });
export const getSrsStats = (pairId: number) => invoke<SrsStats>("get_srs_stats", { pairId });

// Grammar
export const getGrammarTopics = (pairId: number) => invoke<GrammarTopic[]>("get_grammar_topics", { pairId });
export const markGrammarCompleted = (topicId: string, pairId: number, correct: number, total: number) =>
  invoke<void>("mark_grammar_completed", { topicId, pairId, correct, total });

// Conjugation
export const getVerbs = (pairId: number, query?: string) => invoke<Verb[]>("get_verbs", { pairId, query: query ?? null });
export const logConjugationSession = (pairId: number, verb: string, tense: string, correct: boolean, errors: string[]) =>
  invoke<void>("log_conjugation_session", { pairId, verb, tense, correct, errors });

// Memory
export const readMemoryFile = (path: string) => invoke<string | null>("read_memory_file", { path });
export const writeMemoryFile = (path: string, content: string) => invoke<void>("write_memory_file", { path, content });

// AI
export const askAi = (prompt: string) => invoke<string>("ask_ai", { prompt });
export const getAiSettings = () => invoke<AiSettings>("get_ai_settings_cmd");
export const setAiProvider = (provider: string, apiKey: string, model: string) =>
  invoke<void>("set_ai_provider", { provider, apiKey, model });

// Session
export const logSession = (pairId: number, sessionType: string, sessionData: Record<string, unknown>) =>
  invoke<void>("log_session", { pairId, sessionType, sessionData });

// Import
export const importBuiltinData = (pairId: number) => invoke<string>("import_builtin_data", { pairId });

// Speech
export const getWhisperModels = () => invoke<WhisperModelInfo[]>("get_whisper_models");
export const downloadWhisperModel = (modelName: string) => invoke<string>("download_whisper_model", { modelName });
export const deleteWhisperModel = (modelName: string) => invoke<string>("delete_whisper_model", { modelName });
export const transcribeAudio = (audioData: number[], language?: string) =>
  invoke<string>("transcribe_audio", { audioData, language: language ?? null });

// Download
export const getAvailableDictionaries = () => invoke<DictionarySource[]>("get_available_dictionaries");
export const downloadDictionary = (sourceLang: string, targetLang: string, url: string, sourceName: string, targetName: string) =>
  invoke<string>("download_dictionary", { sourceLang, targetLang, url, sourceName, targetName });

// Favorites
export const toggleFavorite = (wordId: number) => invoke<boolean>("toggle_favorite", { wordId });
export const getFavorites = (pairId: number) => invoke<FavoriteWord[]>("get_favorites", { pairId });
export const isFavorite = (wordId: number) => invoke<boolean>("is_favorite", { wordId });

// Stats
export const getDailyStats = (pairId: number, days: number) => invoke<DailyStatRow[]>("get_daily_stats", { pairId, days });
export const getOverviewStats = (pairId: number) => invoke<OverviewStats>("get_overview_stats", { pairId });
export const logError = (pairId: number, errorType: string, wordOrTopic: string, userAnswer: string, correctAnswer: string) =>
  invoke<void>("log_error", { pairId, errorType, wordOrTopic, userAnswer, correctAnswer });
export const getFrequentErrors = (pairId: number, limit?: number) =>
  invoke<Array<{ word: string; type: string; count: number; correct: string }>>("get_frequent_errors", { pairId, limit: limit ?? null });
export const addCustomWord = (pairId: number, sourceWord: string, targetWord: string, gender?: string, level?: string, category?: string) =>
  invoke<number>("add_custom_word", { pairId, sourceWord, targetWord, gender: gender ?? null, level: level ?? null, category: category ?? null });
export const getRandomWord = (pairId: number) => invoke<Word | null>("get_random_word", { pairId });

// Export/Import
export const exportProgress = (pairId: number) => invoke<Record<string, unknown>>("export_progress", { pairId });
export const importProgress = (pairId: number, data: Record<string, unknown>) => invoke<string>("import_progress", { pairId, data });

// Maintenance
export const clearCache = () => invoke<string>("clear_cache");
export const resetProgress = () => invoke<string>("reset_progress");
