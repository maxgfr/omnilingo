// bridge.js — Bridge vers le backend Tauri (IPC invoke)

const Bridge = {
  _invoke: window.__TAURI__ ? window.__TAURI__.core.invoke : null,

  async invoke(cmd, args = {}) {
    if (!this._invoke) {
      // Fallback: lazy-load __TAURI__ (may not be available immediately)
      if (window.__TAURI__) {
        this._invoke = window.__TAURI__.core.invoke;
      } else {
        console.error('Tauri IPC not available');
        return null;
      }
    }
    try {
      return await this._invoke(cmd, args);
    } catch (e) {
      console.error(`Bridge.${cmd} error:`, e);
      return null;
    }
  },

  // --- Settings ---
  async getSettings() {
    return await this.invoke('get_settings');
  },

  async updateSetting(key, value) {
    return await this.invoke('update_setting', { key, value: String(value) });
  },

  async getLanguagePairs() {
    return await this.invoke('get_language_pairs') || [];
  },

  async setActiveLanguagePair(pairId) {
    return await this.invoke('set_active_language_pair', { pair_id: pairId });
  },

  async updateStreak() {
    return await this.invoke('update_streak');
  },

  // --- Dictionary ---
  async getWords(pairId, level, limit, offset) {
    return await this.invoke('get_words', {
      pair_id: pairId, level: level || null, limit: limit || 50, offset: offset || 0,
    }) || [];
  },

  async searchWords(pairId, query, level, category) {
    return await this.invoke('search_words', {
      pair_id: pairId, query, level: level || null, category: category || null,
    }) || [];
  },

  async getUnlearnedWords(pairId, level, limit) {
    return await this.invoke('get_unlearned_words', {
      pair_id: pairId, level: level || null, limit: limit || 10,
    }) || [];
  },

  async getWordCount(pairId) {
    return await this.invoke('get_word_count', { pair_id: pairId }) || 0;
  },

  async getCategories(pairId) {
    return await this.invoke('get_categories', { pair_id: pairId }) || [];
  },

  // --- SRS ---
  async addWordToSrs(wordId) {
    return await this.invoke('add_word_to_srs', { word_id: wordId });
  },

  async getDueCards(pairId) {
    return await this.invoke('get_due_cards', { pair_id: pairId }) || [];
  },

  async getDueCount(pairId) {
    return await this.invoke('get_due_count', { pair_id: pairId }) || 0;
  },

  async reviewCard(cardId, quality) {
    return await this.invoke('review_card', { card_id: cardId, quality });
  },

  async getSrsStats(pairId) {
    return await this.invoke('get_srs_stats', { pair_id: pairId }) || { total_cards: 0, due_count: 0, average_accuracy: 0 };
  },

  // --- Grammar ---
  async getGrammarTopics(pairId) {
    return await this.invoke('get_grammar_topics', { pair_id: pairId }) || [];
  },

  async markGrammarCompleted(topicId, pairId, correct, total) {
    return await this.invoke('mark_grammar_completed', {
      topic_id: topicId, pair_id: pairId, correct, total,
    });
  },

  // --- Conjugation ---
  async getVerbs(pairId, query) {
    return await this.invoke('get_verbs', { pair_id: pairId, query: query || null }) || [];
  },

  async logConjugationSession(pairId, verb, tense, correct, errors) {
    return await this.invoke('log_conjugation_session', {
      pair_id: pairId, verb, tense, correct, errors,
    });
  },

  // --- Memory ---
  async readMemory(filePath) {
    return await this.invoke('read_memory_file', { path: filePath });
  },

  async writeMemory(filePath, content) {
    return await this.invoke('write_memory_file', { path: filePath, content });
  },

  // --- AI (multi-provider) ---
  async askAi(prompt) {
    try {
      if (!this._invoke && window.__TAURI__) {
        this._invoke = window.__TAURI__.core.invoke;
      }
      if (!this._invoke) return null;
      return await this._invoke('ask_ai', { prompt });
    } catch (e) {
      console.error('Bridge.askAi error:', e);
      return typeof e === 'string' ? e : null;
    }
  },

  async getAiSettings() {
    return await this.invoke('get_ai_settings_cmd');
  },

  async setAiProvider(provider, apiKey, model) {
    return await this.invoke('set_ai_provider', {
      provider, api_key: apiKey, model: model || '',
    });
  },

  // --- Session ---
  async logSession(pairId, sessionType, sessionData) {
    return await this.invoke('log_session', {
      pair_id: pairId, session_type: sessionType, session_data: sessionData,
    });
  },

  // --- Import ---
  async importBuiltinData(pairId) {
    return await this.invoke('import_builtin_data', { pair_id: pairId });
  },

  // --- Speech (STT via Whisper) ---
  async getWhisperModels() {
    return await this.invoke('get_whisper_models') || [];
  },

  async downloadWhisperModel(modelName) {
    return await this.invoke('download_whisper_model', { model_name: modelName });
  },

  async transcribeAudio(audioData, language) {
    return await this.invoke('transcribe_audio', {
      audio_data: Array.from(audioData),
      language: language || null,
    });
  },

  // --- Dictionary Download ---
  async getAvailableDictionaries() {
    return await this.invoke('get_available_dictionaries') || [];
  },

  async downloadDictionary(sourceLang, targetLang, url, sourceName, targetName) {
    return await this.invoke('download_dictionary', {
      source_lang: sourceLang, target_lang: targetLang, url,
      source_name: sourceName, target_name: targetName,
    });
  },

  // --- Maintenance ---
  async clearCache() {
    return await this.invoke('clear_cache');
  },

  async resetProgress() {
    return await this.invoke('reset_progress');
  },
};
