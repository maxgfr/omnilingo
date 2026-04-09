import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock bridge ──────────────────────────────────────────────────────
vi.mock("../lib/bridge", () => ({
  getSettings: vi.fn().mockResolvedValue({
    active_language_pair_id: 1,
    dark_mode: "system", ai_provider: "claude-code", ai_model: "",
  }),
  getLanguagePairs: vi.fn().mockResolvedValue([{
    id: 1, source_lang: "de", target_lang: "fr",
    source_name: "German", target_name: "French",
    source_flag: "🇩🇪", target_flag: "🇫🇷", is_active: true,
  }]),
  askAi: vi.fn().mockResolvedValue('{"translation":"maison"}'),
  searchWords: vi.fn().mockResolvedValue([]),
  getVerbs: vi.fn().mockResolvedValue([]),
  readMemoryFile: vi.fn().mockResolvedValue(null),
  setActiveLanguagePair: vi.fn().mockResolvedValue(undefined),
  updateSetting: vi.fn().mockResolvedValue(undefined),
}));


vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

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
    localStorage.clear();
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

  it("getCachedResult returns null for uncached entries", async () => {
    const { getCachedResult } = await import("../lib/ai-cache");
    expect(getCachedResult("tool", "input", 1)).toBeNull();
  });

  it("getCachedResult returns cached result within TTL", async () => {
    const { getCachedResult } = await import("../lib/ai-cache");
    const key = "omnilingo-ai-cache-tool-1-input";
    sessionStorage.setItem(key, JSON.stringify({ result: "cached-value", timestamp: Date.now() }));
    expect(getCachedResult("tool", "input", 1)).toBe("cached-value");
  });

  it("getCachedResult returns null for expired entries", async () => {
    const { getCachedResult } = await import("../lib/ai-cache");
    const key = "omnilingo-ai-cache-tool-1-old";
    const expired = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    sessionStorage.setItem(key, JSON.stringify({ result: "old-value", timestamp: expired }));
    expect(getCachedResult("tool", "old", 1)).toBeNull();
  });

  it("getCachedResult is case-insensitive on input", async () => {
    const { getCachedResult } = await import("../lib/ai-cache");
    const key = "omnilingo-ai-cache-tool-1-haus";
    sessionStorage.setItem(key, JSON.stringify({ result: "ok", timestamp: Date.now() }));
    expect(getCachedResult("tool", "Haus", 1)).toBe("ok");
    expect(getCachedResult("tool", "HAUS", 1)).toBe("ok");
  });

  it("clearToolHistory removes specific tool history", async () => {
    const { addToHistory, getSearchHistory, clearToolHistory } = await import("../lib/ai-cache");
    addToHistory(1, "rephrase", "hello");
    addToHistory(1, "corrector", "world");
    clearToolHistory(1, "rephrase");
    const history = getSearchHistory(1);
    expect(history.every((h) => h.tool !== "rephrase")).toBe(true);
    expect(history.some((h) => h.tool === "corrector")).toBe(true);
  });

  it("clearToolHistory removes all history when no tool specified", async () => {
    const { addToHistory, getSearchHistory, clearToolHistory } = await import("../lib/ai-cache");
    addToHistory(1, "rephrase", "hello");
    addToHistory(1, "corrector", "world");
    clearToolHistory(1);
    expect(getSearchHistory(1)).toEqual([]);
  });

  it("clearToolHistory clears session cache for tool", async () => {
    const { clearToolHistory } = await import("../lib/ai-cache");
    const key = "omnilingo-ai-cache-rephrase-1-test";
    sessionStorage.setItem(key, JSON.stringify({ result: "cached", timestamp: Date.now() }));
    clearToolHistory(1, "rephrase");
    expect(sessionStorage.getItem(key)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3. Tool component imports
// ─────────────────────────────────────────────────────────────────────
describe("Tool component imports", () => {
  const TOOL_COMPONENTS = [
    { name: "CorrectorTool", path: "../components/tools/CorrectorTool" },
    { name: "RephraseTool", path: "../components/tools/RephraseTool" },
    { name: "SynonymsTool", path: "../components/tools/SynonymsTool" },
    { name: "SentenceMiningTool", path: "../components/tools/SentenceMiningTool" },
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
// 4. i18n tools keys completeness
// ─────────────────────────────────────────────────────────────────────
describe("i18n tools keys", () => {
  it("tools section exists in locale", async () => {
    const locale = await import("../i18n/locales/en.json");
    expect(locale.default.tools).toBeDefined();
    expect(locale.default.tools.title).toBeDefined();
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
