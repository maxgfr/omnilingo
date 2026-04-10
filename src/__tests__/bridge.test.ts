import { describe, it, expect, vi, beforeEach } from "vitest";

// Track invoke calls
const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("bridge", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  // Helper: get fresh bridge module
  async function getBridge() {
    return import("../lib/bridge");
  }

  // ── Settings ────────────────────────────────────────────────────────
  describe("settings", () => {
    it("getSettings calls invoke with correct command", async () => {
      mockInvoke.mockResolvedValueOnce({
        active_language_pair_id: 1, dark_mode: "system", ai_provider: "claude-code", ai_model: "",
      });
      const bridge = await getBridge();
      await bridge.getSettings();
      expect(mockInvoke).toHaveBeenCalledWith("get_settings", undefined);
    });

    it("updateSetting passes key and value", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.updateSetting("dark_mode", "dark");
      expect(mockInvoke).toHaveBeenCalledWith("update_setting", { key: "dark_mode", value: "dark" });
    });

    it("getLanguagePairs calls invoke", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.getLanguagePairs();
      expect(mockInvoke).toHaveBeenCalledWith("get_language_pairs", undefined);
    });

    it("setActiveLanguagePair passes pairId", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.setActiveLanguagePair(5);
      expect(mockInvoke).toHaveBeenCalledWith("set_active_language_pair", { pairId: 5 });
    });

    it("deleteLanguagePair passes pairId", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.deleteLanguagePair(3);
      expect(mockInvoke).toHaveBeenCalledWith("delete_language_pair", { pairId: 3 });
    });
  });

  // ── Dictionary ──────────────────────────────────────────────────────
  describe("dictionary", () => {
    it("searchWords passes all parameters", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.searchWords(1, "Haus", "A1", "noun", 2);
      expect(mockInvoke).toHaveBeenCalledWith("search_words", {
        pairId: 1, query: "Haus", level: "A1", category: "noun", reversePairId: 2,
      });
    });

    it("searchWords defaults null for optional params", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.searchWords(1, "test");
      expect(mockInvoke).toHaveBeenCalledWith("search_words", {
        pairId: 1, query: "test", level: null, category: null, reversePairId: null,
      });
    });

    it("getAllDictionaryWords passes pairId and reversePairId", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.getAllDictionaryWords(1, 2);
      expect(mockInvoke).toHaveBeenCalledWith("get_all_dictionary_words", { pairId: 1, reversePairId: 2 });
    });

    it("getAllDictionaryWords defaults reversePairId to null", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.getAllDictionaryWords(1);
      expect(mockInvoke).toHaveBeenCalledWith("get_all_dictionary_words", { pairId: 1, reversePairId: null });
    });
  });

  // ── Grammar ─────────────────────────────────────────────────────────
  describe("grammar", () => {
    it("getGrammarTopics passes pairId", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.getGrammarTopics(1);
      expect(mockInvoke).toHaveBeenCalledWith("get_grammar_topics", { pairId: 1 });
    });

    it("markGrammarCompleted passes all params", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.markGrammarCompleted("topic-1", 1, 8, 10);
      expect(mockInvoke).toHaveBeenCalledWith("mark_grammar_completed", { topicId: "topic-1", pairId: 1, correct: 8, total: 10 });
    });

    it("getDueGrammarTopics passes pairId", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.getDueGrammarTopics(1);
      expect(mockInvoke).toHaveBeenCalledWith("get_due_grammar_topics", { pairId: 1 });
    });

    it("reviewGrammarTopic passes topicId, pairId, quality", async () => {
      mockInvoke.mockResolvedValueOnce({ topic_id: "t1", language_pair_id: 1, repetitions: 2, ease_factor: 2.5, interval_days: 1, next_review: "2025-01-01", last_score: 3 });
      const bridge = await getBridge();
      await bridge.reviewGrammarTopic("t1", 1, 3);
      expect(mockInvoke).toHaveBeenCalledWith("review_grammar_topic", { topicId: "t1", pairId: 1, quality: 3 });
    });

    it("saveGrammarTopic passes input object", async () => {
      mockInvoke.mockResolvedValueOnce("topic-id");
      const bridge = await getBridge();
      await bridge.saveGrammarTopic({ pairId: 1, level: "A1", title: "Nominativ", explanation: "test" });
      expect(mockInvoke).toHaveBeenCalledWith("save_grammar_topic", {
        input: { pair_id: 1, level: "A1", title: "Nominativ", title_source: null, explanation: "test", key_points: null, examples: null, exercises: null },
      });
    });

    it("deleteGrammarTopic passes topicId and pairId", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.deleteGrammarTopic("t1", 1);
      expect(mockInvoke).toHaveBeenCalledWith("delete_grammar_topic", { topicId: "t1", pairId: 1 });
    });
  });

  // ── Conjugation ─────────────────────────────────────────────────────
  describe("conjugation", () => {
    it("getVerbs passes pairId and query", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.getVerbs(1, "mach");
      expect(mockInvoke).toHaveBeenCalledWith("get_verbs", { pairId: 1, query: "mach" });
    });

    it("saveVerb passes input object", async () => {
      mockInvoke.mockResolvedValueOnce(1);
      const bridge = await getBridge();
      const id = await bridge.saveVerb(1, "machen", "faire", "A1", "weak", "haben", false, { present: {} }, null);
      expect(id).toBe(1);
      expect(mockInvoke).toHaveBeenCalledWith("save_verb", {
        input: { pair_id: 1, infinitive: "machen", translation: "faire", level: "A1", verb_type: "weak", auxiliary: "haben", is_separable: false, conjugations: { present: {} }, examples: null },
      });
    });

    it("deleteVerb passes verbId", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.deleteVerb(5);
      expect(mockInvoke).toHaveBeenCalledWith("delete_verb", { verbId: 5 });
    });

    it("getConjugationStats passes pairId", async () => {
      mockInvoke.mockResolvedValueOnce({ total_sessions: 0, by_tense: [], by_verb: [] });
      const bridge = await getBridge();
      await bridge.getConjugationStats(1);
      expect(mockInvoke).toHaveBeenCalledWith("get_conjugation_stats", { pairId: 1 });
    });

    it("logConjugationSession passes all params", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.logConjugationSession(1, "machen", "present", true, []);
      expect(mockInvoke).toHaveBeenCalledWith("log_conjugation_session", { pairId: 1, verb: "machen", tense: "present", correct: true, errors: [] });
    });
  });

  // ── Memory ──────────────────────────────────────────────────────────
  describe("memory", () => {
    it("readMemoryFile passes path", async () => {
      mockInvoke.mockResolvedValueOnce("# Errors\n- test");
      const bridge = await getBridge();
      const result = await bridge.readMemoryFile("errors.md");
      expect(mockInvoke).toHaveBeenCalledWith("read_memory_file", { path: "errors.md" });
      expect(result).toBe("# Errors\n- test");
    });
  });

  // ── AI ──────────────────────────────────────────────────────────────
  describe("ai", () => {
    it("askAi passes prompt", async () => {
      mockInvoke.mockResolvedValueOnce("response text");
      const bridge = await getBridge();
      const result = await bridge.askAi("tell me about Haus");
      expect(mockInvoke).toHaveBeenCalledWith("ask_ai", { prompt: "tell me about Haus" });
      expect(result).toBe("response text");
    });

    it("askAiConversation passes messages array", async () => {
      mockInvoke.mockResolvedValueOnce("response");
      const bridge = await getBridge();
      await bridge.askAiConversation([{ role: "user", content: "hello" }]);
      expect(mockInvoke).toHaveBeenCalledWith("ask_ai_conversation", { messages: [{ role: "user", content: "hello" }] });
    });

    it("getAiSettings calls invoke", async () => {
      mockInvoke.mockResolvedValueOnce({ provider: "anthropic", api_key: "sk-test", model: "claude-sonnet-4-6" });
      const bridge = await getBridge();
      const result = await bridge.getAiSettings();
      expect(mockInvoke).toHaveBeenCalledWith("get_ai_settings_cmd", undefined);
      expect(result.provider).toBe("anthropic");
    });

    it("setAiProvider passes all params", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.setAiProvider("openai", "sk-key", "gpt-4o");
      expect(mockInvoke).toHaveBeenCalledWith("set_ai_provider", { provider: "openai", apiKey: "sk-key", model: "gpt-4o" });
    });

    it("setAiCustomUrl passes url", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.setAiCustomUrl("http://localhost:11434");
      expect(mockInvoke).toHaveBeenCalledWith("set_ai_custom_url", { url: "http://localhost:11434" });
    });

    it("testAiConnection passes all params including customUrl", async () => {
      mockInvoke.mockResolvedValueOnce("OK");
      const bridge = await getBridge();
      await bridge.testAiConnection("glm", "key123", "glm-4", "http://custom");
      expect(mockInvoke).toHaveBeenCalledWith("test_ai_connection", {
        provider: "glm", apiKey: "key123", model: "glm-4", customUrl: "http://custom",
      });
    });

    it("generateVocabulary passes pairId, count, level, theme", async () => {
      mockInvoke.mockResolvedValueOnce(10);
      const bridge = await getBridge();
      await bridge.generateVocabulary(1, 20, "A2", "animals");
      expect(mockInvoke).toHaveBeenCalledWith("generate_vocabulary", { pairId: 1, count: 20, level: "A2", theme: "animals" });
    });

    it("generateGrammar passes pairId, count, level", async () => {
      mockInvoke.mockResolvedValueOnce(5);
      const bridge = await getBridge();
      await bridge.generateGrammar(1, 3, "B1");
      expect(mockInvoke).toHaveBeenCalledWith("generate_grammar", { pairId: 1, count: 3, level: "B1" });
    });

    it("generateVerbs passes pairId, count, level", async () => {
      mockInvoke.mockResolvedValueOnce(8);
      const bridge = await getBridge();
      await bridge.generateVerbs(1, 10, "A1");
      expect(mockInvoke).toHaveBeenCalledWith("generate_verbs", { pairId: 1, count: 10, level: "A1" });
    });
  });

  // ── Chat ────────────────────────────────────────────────────────────
  describe("chat", () => {
    it("getChatHistory passes pairId and limit", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.getChatHistory(1, 50);
      expect(mockInvoke).toHaveBeenCalledWith("get_chat_history", { pairId: 1, limit: 50 });
    });

    it("saveChatMessage passes pairId, role, content", async () => {
      mockInvoke.mockResolvedValueOnce(1);
      const bridge = await getBridge();
      await bridge.saveChatMessage(1, "user", "hello");
      expect(mockInvoke).toHaveBeenCalledWith("save_chat_message", { pairId: 1, role: "user", content: "hello" });
    });

    it("clearChatHistory passes pairId", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.clearChatHistory(1);
      expect(mockInvoke).toHaveBeenCalledWith("clear_chat_history", { pairId: 1 });
    });
  });

  // ── Conversation ────────────────────────────────────────────────────
  describe("conversation", () => {
    it("getConversationScenarios passes pairId", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.getConversationScenarios(1);
      expect(mockInvoke).toHaveBeenCalledWith("get_conversation_scenarios", { pairId: 1 });
    });

    it("saveConversationScenario passes all params", async () => {
      mockInvoke.mockResolvedValueOnce(1);
      const bridge = await getBridge();
      await bridge.saveConversationScenario(1, "Cafe", "☕", "Order coffee", "You are a waiter");
      expect(mockInvoke).toHaveBeenCalledWith("save_conversation_scenario", {
        pairId: 1, name: "Cafe", icon: "☕", description: "Order coffee", systemPrompt: "You are a waiter",
      });
    });

    it("updateConversationScenario passes scenarioId and fields", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.updateConversationScenario(1, "Updated", "☕", "New desc", "New prompt");
      expect(mockInvoke).toHaveBeenCalledWith("update_conversation_scenario", {
        scenarioId: 1, name: "Updated", icon: "☕", description: "New desc", systemPrompt: "New prompt",
      });
    });

    it("deleteConversationScenario passes scenarioId", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.deleteConversationScenario(5);
      expect(mockInvoke).toHaveBeenCalledWith("delete_conversation_scenario", { scenarioId: 5 });
    });

    it("getConversationSessions passes pairId and limit", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.getConversationSessions(1, 10);
      expect(mockInvoke).toHaveBeenCalledWith("get_conversation_sessions", { pairId: 1, limit: 10 });
    });

    it("saveConversationSession passes all params", async () => {
      mockInvoke.mockResolvedValueOnce(1);
      const bridge = await getBridge();
      await bridge.saveConversationSession(1, 2, "correct", "Test session", "[]");
      expect(mockInvoke).toHaveBeenCalledWith("save_conversation_session", {
        pairId: 1, scenarioId: 2, mode: "correct", title: "Test session", messages: "[]",
      });
    });

    it("deleteConversationSession passes sessionId", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.deleteConversationSession(3);
      expect(mockInvoke).toHaveBeenCalledWith("delete_conversation_session", { sessionId: 3 });
    });
  });

  // ── Session & Import ────────────────────────────────────────────────
  describe("session and import", () => {
    it("logSession passes pairId, type, data", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const bridge = await getBridge();
      await bridge.logSession(1, "grammar_error", { word: "Haus" });
      expect(mockInvoke).toHaveBeenCalledWith("log_session", { pairId: 1, sessionType: "grammar_error", sessionData: { word: "Haus" } });
    });

    it("importBuiltinData passes pairId", async () => {
      mockInvoke.mockResolvedValueOnce("OK");
      const bridge = await getBridge();
      await bridge.importBuiltinData(1);
      expect(mockInvoke).toHaveBeenCalledWith("import_builtin_data", { pairId: 1 });
    });

    it("importFromFile passes pairId, content, format", async () => {
      mockInvoke.mockResolvedValueOnce("OK");
      const bridge = await getBridge();
      await bridge.importFromFile(1, "csv,data", "csv");
      expect(mockInvoke).toHaveBeenCalledWith("import_from_file", { pairId: 1, content: "csv,data", format: "csv" });
    });
  });

  // ── Download ────────────────────────────────────────────────────────
  describe("download", () => {
    it("getAvailableDictionaries calls invoke", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      const bridge = await getBridge();
      await bridge.getAvailableDictionaries();
      expect(mockInvoke).toHaveBeenCalledWith("get_available_dictionaries", undefined);
    });

    it("downloadDictionary passes all params", async () => {
      mockInvoke.mockResolvedValueOnce("OK");
      const bridge = await getBridge();
      await bridge.downloadDictionary("de", "fr", "http://test", "German", "French", "tsv");
      expect(mockInvoke).toHaveBeenCalledWith("download_dictionary", {
        sourceLang: "de", targetLang: "fr", url: "http://test", sourceName: "German", targetName: "French", format: "tsv",
      });
    });
  });

  // ── Export & Maintenance ────────────────────────────────────────────
  describe("export and maintenance", () => {
    it("exportData calls invoke", async () => {
      mockInvoke.mockResolvedValueOnce("{}");
      const bridge = await getBridge();
      const result = await bridge.exportData();
      expect(mockInvoke).toHaveBeenCalledWith("export_data", undefined);
      expect(result).toBe("{}");
    });

    it("deleteAllData calls invoke", async () => {
      mockInvoke.mockResolvedValueOnce("All data deleted");
      const bridge = await getBridge();
      const result = await bridge.deleteAllData();
      expect(mockInvoke).toHaveBeenCalledWith("delete_all_data", undefined);
      expect(result).toBe("All data deleted");
    });

    it("fetchModelCatalog calls invoke", async () => {
      mockInvoke.mockResolvedValueOnce({ anthropic: ["claude-sonnet-4-6"] });
      const bridge = await getBridge();
      const result = await bridge.fetchModelCatalog();
      expect(mockInvoke).toHaveBeenCalledWith("fetch_model_catalog", undefined);
      expect(result.anthropic).toContain("claude-sonnet-4-6");
    });
  });

  // ── Error handling ──────────────────────────────────────────────────
  describe("error handling", () => {
    it("wraps IPC errors with command name", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("connection refused"));
      const bridge = await getBridge();
      await expect(bridge.askAi("test")).rejects.toThrow(
        'IPC call "ask_ai" failed: connection refused'
      );
    });

    it("wraps string errors", async () => {
      mockInvoke.mockRejectedValueOnce("some string error");
      const bridge = await getBridge();
      await expect(bridge.askAi("test")).rejects.toThrow(
        'IPC call "ask_ai" failed: some string error'
      );
    });
  });
});
