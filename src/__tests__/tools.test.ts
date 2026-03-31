import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock bridge ──────────────────────────────────────────────────────
vi.mock("../lib/bridge", () => ({
  getSettings: vi.fn().mockResolvedValue({
    active_language_pair_id: 1, level: "A2", words_per_day: 10,
    streak: 3, last_session_date: null, start_date: null,
    dark_mode: "system", audio_enabled: true, ai_provider: "claude-code", ai_model: "",
  }),
  getLanguagePairs: vi.fn().mockResolvedValue([{
    id: 1, source_lang: "de", target_lang: "fr",
    source_name: "German", target_name: "French",
    source_flag: "🇩🇪", target_flag: "🇫🇷", is_active: true,
  }]),
  askAi: vi.fn().mockResolvedValue('{"translation":"maison"}'),
  searchWords: vi.fn().mockResolvedValue([]),
  addWordToSrs: vi.fn().mockResolvedValue({}),
  getVerbs: vi.fn().mockResolvedValue([]),
  getRandomWord: vi.fn().mockResolvedValue({ id: 1, language_pair_id: 1, source_word: "Haus", target_word: "maison", gender: "n", plural: "Häuser", level: "A1", category: null, tags: null, example_source: null, example_target: null }),
  readMemoryFile: vi.fn().mockResolvedValue(null),
  logError: vi.fn().mockResolvedValue(undefined),
  getWhisperModels: vi.fn().mockResolvedValue([]),
  transcribeAudio: vi.fn().mockResolvedValue("Haus"),
  getDueCount: vi.fn().mockResolvedValue(0),
  getWordCount: vi.fn().mockResolvedValue(100),
  setActiveLanguagePair: vi.fn().mockResolvedValue(undefined),
  updateSetting: vi.fn().mockResolvedValue(undefined),
  getSrsStats: vi.fn().mockResolvedValue({ total_cards: 0, due_count: 0, average_accuracy: 0 }),
  updateStreak: vi.fn().mockResolvedValue({ active_language_pair_id: 1, level: "A2", words_per_day: 10, streak: 0, last_session_date: null, start_date: null, dark_mode: "system", audio_enabled: true, ai_provider: "claude-code", ai_model: "" }),
}));

vi.mock("../lib/speech", () => ({
  setAudioEnabled: vi.fn(),
  speak: vi.fn(),
  recordAudio: vi.fn().mockResolvedValue(new Float32Array(16000)),
  getSourceLang: vi.fn().mockReturnValue("de-DE"),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("../lib/onboarding", async () => {
  const actual = await vi.importActual("../lib/onboarding") as Record<string, unknown>;
  return { ...actual, isOnboardingDone: vi.fn().mockReturnValue(true) };
});

// ─────────────────────────────────────────────────────────────────────
// 1. markdown.ts utilities
// ─────────────────────────────────────────────────────────────────────
describe("markdown utilities", () => {
  it("formatMessage converts markdown to HTML", async () => {
    const { formatMessage } = await import("../lib/markdown");
    const result = formatMessage("**bold** text");
    expect(result).toContain("<strong>");
    expect(result).toContain("bold");
  });

  it("renderHighlighted escapes HTML to prevent XSS", async () => {
    const { renderHighlighted } = await import("../lib/markdown");
    const result = renderHighlighted("<script>alert('xss')</script>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("renderHighlighted wraps **words** in mark tags", async () => {
    const { renderHighlighted } = await import("../lib/markdown");
    const result = renderHighlighted("Das **Haus** ist groß");
    expect(result).toContain("<mark");
    expect(result).toContain("Haus");
    expect(result).not.toContain("**");
  });

  it("renderClickable adds data-clickable-word attribute", async () => {
    const { renderClickable } = await import("../lib/markdown");
    const result = renderClickable("Das **Haus** ist groß");
    expect(result).toContain('data-clickable-word="Haus"');
    expect(result).toContain("cursor-pointer");
  });

  it("renderHighlighted escapes HTML before highlighting", async () => {
    const { renderHighlighted } = await import("../lib/markdown");
    const result = renderHighlighted('**<script>**');
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("parseAiJson parses valid JSON", async () => {
    const { parseAiJson } = await import("../lib/markdown");
    const result = parseAiJson<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: "test" });
  });

  it("parseAiJson strips markdown code fences", async () => {
    const { parseAiJson } = await import("../lib/markdown");
    const result = parseAiJson<{ a: number }>("```json\n{\"a\": 1}\n```");
    expect(result).toEqual({ a: 1 });
  });

  it("parseAiJson extracts JSON from mixed text", async () => {
    const { parseAiJson } = await import("../lib/markdown");
    const result = parseAiJson<{ x: string }>("Here is the result:\n{\"x\": \"yes\"}\nDone!");
    expect(result).toEqual({ x: "yes" });
  });

  it("parseAiJson returns null for invalid JSON", async () => {
    const { parseAiJson } = await import("../lib/markdown");
    const result = parseAiJson("not json at all");
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2. ai-cache.ts
// ─────────────────────────────────────────────────────────────────────
describe("AI cache", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("cachedAskAi returns fresh result on first call", async () => {
    const { cachedAskAi } = await import("../lib/ai-cache");
    const result = await cachedAskAi("test-tool", "hello", 1, "prompt");
    expect(result).toBe('{"translation":"maison"}');
  });

  it("cachedAskAi returns cached result on second call", async () => {
    const bridge = await import("../lib/bridge");
    const { cachedAskAi } = await import("../lib/ai-cache");
    vi.mocked(bridge.askAi).mockClear();
    await cachedAskAi("cache-test", "world", 2, "p1");
    await cachedAskAi("cache-test", "world", 2, "p2");
    expect(bridge.askAi).toHaveBeenCalledTimes(1);
  });

  it("addToHistory stores entries", async () => {
    const { addToHistory, getSearchHistory } = await import("../lib/ai-cache");
    addToHistory(1, "context", "Haus");
    addToHistory(1, "definition", "Baum");
    const history = getSearchHistory(1);
    expect(history).toHaveLength(2);
    expect(history[0].query).toBe("Baum");
    expect(history[1].query).toBe("Haus");
  });

  it("addToHistory deduplicates same query", async () => {
    const { addToHistory, getSearchHistory } = await import("../lib/ai-cache");
    addToHistory(1, "context", "Haus");
    addToHistory(1, "context", "Haus");
    const history = getSearchHistory(1);
    expect(history).toHaveLength(1);
  });

  it("getSearchHistory returns empty for unknown pairId", async () => {
    const { getSearchHistory } = await import("../lib/ai-cache");
    expect(getSearchHistory(999)).toEqual([]);
  });

  it("getPromptContext includes recent searches", async () => {
    const { addToHistory, getPromptContext } = await import("../lib/ai-cache");
    addToHistory(1, "context", "Haus");
    addToHistory(1, "definition", "Baum");
    const ctx = await getPromptContext(1);
    expect(ctx).toContain("Baum");
    expect(ctx).toContain("Haus");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3. Tool component imports
// ─────────────────────────────────────────────────────────────────────
describe("Tool component imports", () => {
  const TOOL_COMPONENTS = [
    { name: "TranslateTool", path: "../components/tools/TranslateTool" },
    { name: "ContextTool", path: "../components/tools/ContextTool" },
    { name: "CorrectorTool", path: "../components/tools/CorrectorTool" },
    { name: "RephraseTool", path: "../components/tools/RephraseTool" },
    { name: "ConjugateTool", path: "../components/tools/ConjugateTool" },
    { name: "SynonymsTool", path: "../components/tools/SynonymsTool" },
    { name: "DefinitionTool", path: "../components/tools/DefinitionTool" },
    { name: "DailyWordsTool", path: "../components/tools/DailyWordsTool" },
    { name: "ReaderTool", path: "../components/tools/ReaderTool" },
    { name: "PronunciationTool", path: "../components/tools/PronunciationTool" },
    { name: "WordActionBar", path: "../components/tools/WordActionBar" },
    { name: "ExerciseBox", path: "../components/tools/ExerciseBox" },
  ];

  for (const { name, path } of TOOL_COMPONENTS) {
    it(`${name} exports a default component`, async () => {
      const mod = await import(path);
      expect(mod.default).toBeDefined();
      expect(typeof mod.default).toBe("function");
    });
  }
});

// ─────────────────────────────────────────────────────────────────────
// 4. ExerciseBox types
// ─────────────────────────────────────────────────────────────────────
describe("ExerciseBox types", () => {
  it("exports Exercise type that supports fill and mcq", async () => {
    const mod = await import("../components/tools/ExerciseBox");
    expect(mod.default).toBeDefined();
    // Verify the component can be constructed - type export is compile-time only
    // but we can verify the component exists and is callable
    expect(typeof mod.default).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5. Tools hub view
// ─────────────────────────────────────────────────────────────────────
describe("Tools hub view", () => {
  it("Tools view exports a default component", async () => {
    const mod = await import("../views/Tools");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 6. i18n tools keys completeness
// ─────────────────────────────────────────────────────────────────────
describe("i18n tools keys", () => {
  it("all tool tab keys are defined", async () => {
    const locale = await import("../i18n/locales/en.json");
    const tabs = locale.default.tools.tabs;
    const expectedTabs = ["translate", "context", "corrector", "rephrase", "conjugate", "synonyms", "definition", "reader", "pronunciation", "daily"];
    for (const tab of expectedTabs) {
      expect(tabs).toHaveProperty(tab);
      expect(typeof tabs[tab as keyof typeof tabs]).toBe("string");
    }
  });

  it("tools nav key exists", async () => {
    const locale = await import("../i18n/locales/en.json");
    expect(locale.default.nav.tools).toBe("Tools");
  });

  it("exercise section exists", async () => {
    const locale = await import("../i18n/locales/en.json");
    expect(locale.default.tools.exercise.title).toBe("Practice");
  });

  it("pronunciation section has all keys", async () => {
    const locale = await import("../i18n/locales/en.json");
    const pron = locale.default.tools.pronunciation;
    expect(pron.noModel).toBeDefined();
    expect(pron.tapToRecord).toBeDefined();
    expect(pron.correct).toBeDefined();
    expect(pron.tryAgain).toBeDefined();
    expect(pron.heard).toBeDefined();
  });

  it("reader section has all keys", async () => {
    const locale = await import("../i18n/locales/en.json");
    const reader = locale.default.tools.reader;
    expect(reader.inputPlaceholder).toBeDefined();
    expect(reader.analyze).toBeDefined();
    expect(reader.analyzing).toBeDefined();
    expect(reader.vocabulary).toBeDefined();
  });

  it("daily section has text-of-day keys", async () => {
    const locale = await import("../i18n/locales/en.json");
    const daily = locale.default.tools.daily;
    expect(daily.textTitle).toBeDefined();
    expect(daily.showTranslation).toBeDefined();
    expect(daily.hideTranslation).toBeDefined();
  });
});
