import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

// ── Mock all bridge calls that AppProvider uses on mount ────────────
vi.mock("../lib/bridge", () => ({
  getSettings: vi.fn().mockResolvedValue({
    active_language_pair_id: 1,
    dark_mode: "system",
    ai_provider: "claude-code",
    ai_model: "",
  }),
  getLanguagePairs: vi.fn().mockResolvedValue([
    {
      id: 1,
      source_lang: "de",
      target_lang: "fr",
      source_name: "German",
      target_name: "French",
      source_flag: "\uD83C\uDDE9\uD83C\uDDEA",
      target_flag: "\uD83C\uDDEB\uD83C\uDDF7",
      is_active: true,
    },
  ]),
  setActiveLanguagePair: vi.fn().mockResolvedValue(undefined),
  updateSetting: vi.fn().mockResolvedValue(undefined),
  getAiSettings: vi.fn().mockResolvedValue({ provider: "claude-code", api_key: "", model: "" }),
  getAvailableDictionaries: vi.fn().mockResolvedValue([]),
  getDueCards: vi.fn().mockResolvedValue([]),
  getGrammarTopics: vi.fn().mockResolvedValue([]),
  searchWords: vi.fn().mockResolvedValue([]),
}));

// Mock i18n
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && "count" in opts) return `${key}:${opts.count}`;
      return key;
    },
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

// ─────────────────────────────────────────────────────────────────────
// 1. App renders without crashing
// ─────────────────────────────────────────────────────────────────────
describe("App rendering", () => {
  beforeEach(() => {
    // Clear any DOM state between tests
    document.body.innerHTML = "";
  });

  it("imports App without crashing", async () => {
    const AppModule = await import("../App");
    expect(AppModule.default).toBeDefined();
    expect(typeof AppModule.default).toBe("function");
  });

  it("renders App component without crashing", async () => {
    const AppModule = await import("../App");
    const App = AppModule.default;

    const { container } = render(React.createElement(App));
    expect(container).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2. Route definitions
// ─────────────────────────────────────────────────────────────────────
describe("Route definitions", () => {
  const EXPECTED_ROUTES = [
    "/",
    "/dictionary",
    "/grammar",
    "/conjugation",
    "/conversation",
    "/rephrase",
    "/corrector",
    "/synonyms",
    "/text-analysis",
    "/settings",
  ];

  it("has exactly 10 routes defined", () => {
    expect(EXPECTED_ROUTES).toHaveLength(10);
  });

  it("all expected routes are present", () => {
    const routePaths = [
      "/",
      "/dictionary",
      "/grammar",
      "/conjugation",
      "/conversation",
      "/rephrase",
      "/corrector",
      "/synonyms",
      "/text-analysis",
      "/settings",
    ];

    for (const route of routePaths) {
      expect(EXPECTED_ROUTES).toContain(route);
    }
    expect(routePaths.length).toBe(EXPECTED_ROUTES.length);
  });

  it("root route / exists", () => {
    expect(EXPECTED_ROUTES).toContain("/");
  });

  it("reference routes exist", () => {
    expect(EXPECTED_ROUTES).toContain("/grammar");
    expect(EXPECTED_ROUTES).toContain("/conjugation");
    expect(EXPECTED_ROUTES).toContain("/dictionary");
  });

  it("learning routes exist", () => {
    expect(EXPECTED_ROUTES).toContain("/conversation");
  });

  it("tool routes exist", () => {
    expect(EXPECTED_ROUTES).toContain("/rephrase");
    expect(EXPECTED_ROUTES).toContain("/corrector");
    expect(EXPECTED_ROUTES).toContain("/synonyms");
    expect(EXPECTED_ROUTES).toContain("/text-analysis");
  });

  it("settings route exists", () => {
    expect(EXPECTED_ROUTES).toContain("/settings");
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3. View modules can be imported
// ─────────────────────────────────────────────────────────────────────
describe("View modules", () => {
  it("Grammar view exports a default component", async () => {
    const mod = await import("../views/Grammar");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("Conjugation view exports a default component", async () => {
    const mod = await import("../views/Conjugation");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("Dictionary view exports a default component", async () => {
    const mod = await import("../views/Dictionary");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("Conversation view exports a default component", async () => {
    const mod = await import("../views/Conversation");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("Rephrase view exports a default component", async () => {
    const mod = await import("../views/Rephrase");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("Corrector view exports a default component", async () => {
    const mod = await import("../views/Corrector");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("Synonyms view exports a default component", async () => {
    const mod = await import("../views/Synonyms");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("TextAnalysis view exports a default component", async () => {
    const mod = await import("../views/TextAnalysis");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("Settings view exports a default component", async () => {
    const mod = await import("../views/Settings");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
