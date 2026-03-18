export interface Settings {
  active_language_pair_id: number | null;
  level: string;
  words_per_day: number;
  streak: number;
  last_session_date: string | null;
  start_date: string | null;
  dark_mode: boolean;
  audio_enabled: boolean;
  ai_provider: string;
  ai_model: string;
}

export interface LanguagePair {
  id: number;
  source_lang: string;
  target_lang: string;
  source_name: string;
  target_name: string;
  source_flag: string;
  target_flag: string;
  is_active: boolean;
}

export interface Word {
  id: number;
  language_pair_id: number;
  source_word: string;
  target_word: string;
  gender: string | null;
  plural: string | null;
  level: string | null;
  category: string | null;
  tags: string | null;
  example_source: string | null;
  example_target: string | null;
}

export interface SrsCard {
  id: number;
  word_id: number;
  source_word: string;
  target_word: string;
  gender: string | null;
  plural: string | null;
  level: string | null;
  category: string | null;
  example_source: string | null;
  example_target: string | null;
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  next_review: string;
  last_score: number | null;
}

export interface SrsStats {
  total_cards: number;
  due_count: number;
  average_accuracy: number;
}

export interface GrammarTopic {
  id: string;
  language_pair_id: number;
  level: string;
  display_order: number;
  title: string;
  title_source: string | null;
  explanation: string;
  key_points: string[] | null;
  examples: Array<{ source: string; target: string; highlight?: string }> | null;
  exercises: Array<Exercise> | null;
  completed: boolean;
  score_correct: number;
  score_total: number;
}

export interface Exercise {
  type: 'qcm' | 'fill' | 'trueFalse' | 'conjugation';
  question?: string;
  options?: string[];
  correctIndex?: number;
  sentence?: string;
  answer?: string;
  hint?: string;
  statement?: string;
  isTrue?: boolean;
  explanation?: string;
}

export interface Verb {
  id: number;
  language_pair_id: number;
  infinitive: string;
  translation: string;
  level: string | null;
  verb_type: string | null;
  auxiliary: string | null;
  is_separable: boolean;
  conjugations: Record<string, Record<string, string>>;
  examples: Array<{ de: string; fr: string }> | null;
}

export interface AiSettings {
  provider: string;
  api_key: string;
  model: string;
}

export interface WhisperModelInfo {
  name: string;
  size_mb: number;
  url: string;
  downloaded: boolean;
}

export interface DictionarySource {
  source_lang: string;
  target_lang: string;
  source_name: string;
  target_name: string;
  source_flag: string;
  target_flag: string;
  provider: string;
  url: string;
  format: string;
  word_count: number | null;
  size_mb: number | null;
}

export interface FavoriteWord {
  id: number;
  word_id: number;
  source_word: string;
  target_word: string;
  gender: string | null;
  level: string | null;
  category: string | null;
}

export interface DailyStatRow {
  date: string;
  words_learned: number;
  words_reviewed: number;
  correct_count: number;
  total_count: number;
}

export interface OverviewStats {
  total_words: number;
  total_learned: number;
  total_reviews: number;
  total_grammar_completed: number;
  total_grammar: number;
  streak: number;
  accuracy: number;
  study_days: number;
  favorite_count: number;
}

export type ViewName = 'dashboard' | 'learn' | 'review' | 'grammar' | 'conjugation' | 'dictionary' | 'chat' | 'settings' | 'stats' | 'quiz' | 'flashcards' | 'conversation';
