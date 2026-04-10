import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as bridge from "../lib/bridge";
import type { Settings, LanguagePair, AiSettings } from "../types";

// ─── View cache types (session-scoped, NOT persisted) ────────────────
interface DictionaryCache {
  searchQuery: string;
  selectedWordId: number | null;
  aiContent: string | null;
}

interface GrammarCache {
  searchQuery: string;
  selectedTopicId: string | null;
  aiTopic: string;
  aiLesson: string | null; // JSON-serialized GrammarTopic
}

interface ConjugationCache {
  aiVerbInput: string;
  // JSON-serialized Verb (the last AI-generated verb in the current session)
  aiVerb: string | null;
  // "table" | "practice"
  view: string;
}

interface ConversationCache {
  screen: string;
  chatMode: string | null;
  messages: Array<{ role: string; content: string }>;
}

// ─── State shape ─────────────────────────────────────────────────────
export interface AppState {
  // Core
  settings: Settings | null;
  languagePairs: LanguagePair[];
  loading: boolean;

  // Active language pair (single, global)
  activePairId: number | null;

  // AI settings (persisted in store + backend)
  aiProvider: string;
  aiApiKey: string;
  aiModel: string;
  aiCustomUrl: string;

  // View caches (session-scoped, NOT persisted to localStorage)
  dictionaryCache: DictionaryCache | null;
  grammarCache: GrammarCache | null;
  conjugationCache: ConjugationCache | null;
  conversationCache: ConversationCache | null;
  toolInputCache: Record<string, string>;
  toolResultCache: Record<string, string>;

  // Actions – core
  reloadSettings: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
  switchPair: (pairId: number) => void;

  // Actions – AI
  setAiConfig: (provider: string, apiKey: string, model: string, customUrl?: string) => Promise<void>;
  loadAiSettings: () => Promise<void>;

  // Actions – view caches
  setDictionaryCache: (cache: DictionaryCache | null) => void;
  setGrammarCache: (cache: GrammarCache | null) => void;
  setConjugationCache: (cache: ConjugationCache | null) => void;
  setConversationCache: (cache: ConversationCache | null) => void;
  setToolInput: (tool: string, value: string) => void;
  setToolResult: (tool: string, value: string | null) => void;

  // Actions – global reset
  resetAllState: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Initial state ────────────────────────────────────────────
      settings: null,
      languagePairs: [],
      loading: true,
      activePairId: null,
      aiProvider: "claude-code",
      aiApiKey: "",
      aiModel: "",
      aiCustomUrl: "",
      dictionaryCache: null,
      grammarCache: null,
      conjugationCache: null,
      conversationCache: null,
      toolInputCache: {},
      toolResultCache: {},

      // ── Core actions ─────────────────────────────────────────────
      reloadSettings: async () => {
        try {
          const [s, pairs] = await Promise.all([
            bridge.getSettings(),
            bridge.getLanguagePairs(),
          ]);
          let ai: AiSettings | null = null;
          try {
            ai = await bridge.getAiSettings();
          } catch { /* ignore */ }

          set((state) => {
            const activePairId = state.activePairId && pairs.some((p) => p.id === state.activePairId)
              ? state.activePairId
              : pairs[0]?.id ?? null;

            return {
              settings: s,
              languagePairs: pairs,
              loading: false,
              activePairId,
              ...(ai ? {
                aiProvider: ai.provider,
                aiModel: ai.model,
                aiApiKey: state.aiApiKey || ai.api_key,
              } : {}),
            };
          });
        } catch (err) {
          console.error("Failed to load settings:", err);
          set({ loading: false });
        }
      },

      updateSetting: async (key: string, value: string) => {
        await bridge.updateSetting(key, value);
        await get().reloadSettings();
      },

      switchPair: (pairId: number) => {
        set({
          activePairId: pairId,
          // Invalidate all view caches on pair switch
          dictionaryCache: null,
          grammarCache: null,
          conjugationCache: null,
          conversationCache: null,
          toolInputCache: {},
          toolResultCache: {},
        });
        bridge.setActiveLanguagePair(pairId).catch(console.error);
      },

      // ── AI actions ───────────────────────────────────────────────
      setAiConfig: async (provider, apiKey, model, customUrl) => {
        await bridge.setAiProvider(provider, apiKey, model);
        set({
          aiProvider: provider,
          aiApiKey: apiKey,
          aiModel: model,
          ...(customUrl !== undefined ? { aiCustomUrl: customUrl } : {}),
        });
      },

      loadAiSettings: async () => {
        try {
          const ai = await bridge.getAiSettings();
          set(() => ({
            aiProvider: ai.provider,
            aiModel: ai.model,
            aiApiKey: ai.api_key,
          }));
        } catch { /* ignore */ }
      },

      // ── Global reset ───────────────────────────────────────────────
      resetAllState: () =>
        set({
          dictionaryCache: null,
          grammarCache: null,
          conjugationCache: null,
          conversationCache: null,
          toolInputCache: {},
          toolResultCache: {},
        }),

      // ── View cache actions ─────────────────────────────────────────
      setDictionaryCache: (cache) => set({ dictionaryCache: cache }),
      setGrammarCache: (cache) => set({ grammarCache: cache }),
      setConjugationCache: (cache) => set({ conjugationCache: cache }),
      setConversationCache: (cache) => set({ conversationCache: cache }),
      setToolInput: (tool, value) =>
        set((state) => ({
          toolInputCache: { ...state.toolInputCache, [tool]: value },
        })),
      setToolResult: (tool, value) =>
        set((state) => {
          const next = { ...state.toolResultCache };
          if (value === null) delete next[tool];
          else next[tool] = value;
          return { toolResultCache: next };
        }),
    }),
    {
      name: "omnilingo-app-store",
      partialize: (state) => ({
        activePairId: state.activePairId,
        aiProvider: state.aiProvider,
        aiApiKey: state.aiApiKey,
        aiModel: state.aiModel,
        aiCustomUrl: state.aiCustomUrl,
      }),
    },
  ),
);

// ─── Derived selectors (pure functions, safe to use in components) ───

export function selectActivePair(state: AppState): LanguagePair | null {
  const { activePairId, languagePairs } = state;
  if (activePairId != null) {
    const found = languagePairs.find((p) => p.id === activePairId);
    if (found) return found;
  }
  return languagePairs[0] ?? null;
}

export function selectReversePairId(state: AppState): number | null {
  const { activePairId, languagePairs } = state;
  const active = languagePairs.find((p) => p.id === activePairId);
  if (!active) return null;
  const reverse = languagePairs.find(
    (p) => p.source_lang === active.target_lang && p.target_lang === active.source_lang,
  );
  return reverse?.id ?? null;
}

export function selectIsAiConfigured(state: AppState): boolean {
  const { aiProvider } = state;
  if (!aiProvider) return false;
  const localProviders = ["claude-code", "ollama", "lmstudio", "codex"];
  if (localProviders.includes(aiProvider)) return true;
  return Boolean(state.aiApiKey);
}
