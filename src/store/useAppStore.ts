import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as bridge from "../lib/bridge";
import type { Settings, LanguagePair, AiSettings } from "../types";

// ─── Flashcards slice ────────────────────────────────────────────────
type FlashcardsScreen = "decks" | "deck-detail" | "review";

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
  searchQuery: string;
  currentVerbId: number | null;
  mode: string;
  selectedTense: string;
  aiVerb: string | null; // JSON-serialized Verb
}

interface ConversationCache {
  screen: string;
  chatMode: string | null;
  messages: Array<{ role: string; content: string }>;
}

// ─── State shape ─────────────────────────────────────────────────────
interface AppState {
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

  // Flashcards navigation
  flashcardsScreen: FlashcardsScreen;
  selectedDeck: string | null;
  reviewDeck: string | null;
  createdDecks: string[]; // deck names created but not yet with cards

  // View caches (session-scoped, NOT persisted to localStorage)
  dictionaryCache: DictionaryCache | null;
  grammarCache: GrammarCache | null;
  conjugationCache: ConjugationCache | null;
  conversationCache: ConversationCache | null;
  toolInputCache: Record<string, string>;

  // Actions – core
  reloadSettings: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
  switchPair: (pairId: number) => void;

  // Actions – AI
  setAiConfig: (provider: string, apiKey: string, model: string, customUrl?: string) => Promise<void>;
  loadAiSettings: () => Promise<void>;

  // Actions – flashcards
  openDeck: (name: string) => void;
  startReview: (deck: string | null) => void;
  goHome: () => void;
  addCreatedDeck: (name: string) => void;
  removeCreatedDeck: (name: string) => void;

  // Actions – view caches
  setDictionaryCache: (cache: DictionaryCache | null) => void;
  setGrammarCache: (cache: GrammarCache | null) => void;
  setConjugationCache: (cache: ConjugationCache | null) => void;
  setConversationCache: (cache: ConversationCache | null) => void;
  setToolInput: (tool: string, value: string) => void;
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
      flashcardsScreen: "decks",
      selectedDeck: null,
      reviewDeck: null,
      createdDecks: [],
      dictionaryCache: null,
      grammarCache: null,
      conjugationCache: null,
      conversationCache: null,
      toolInputCache: {},

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

      // ── Flashcards actions ───────────────────────────────────────
      openDeck: (name) => set({ flashcardsScreen: "deck-detail", selectedDeck: name }),
      startReview: (deck) => set({ flashcardsScreen: "review", reviewDeck: deck }),
      goHome: () => set({ flashcardsScreen: "decks", selectedDeck: null, reviewDeck: null }),
      addCreatedDeck: (name) =>
        set((state) => ({
          createdDecks: state.createdDecks.includes(name) ? state.createdDecks : [...state.createdDecks, name],
        })),
      removeCreatedDeck: (name) =>
        set((state) => ({
          createdDecks: state.createdDecks.filter((d) => d !== name),
        })),

      // ── View cache actions ─────────────────────────────────────────
      setDictionaryCache: (cache) => set({ dictionaryCache: cache }),
      setGrammarCache: (cache) => set({ grammarCache: cache }),
      setConjugationCache: (cache) => set({ conjugationCache: cache }),
      setConversationCache: (cache) => set({ conversationCache: cache }),
      setToolInput: (tool, value) =>
        set((state) => ({
          toolInputCache: { ...state.toolInputCache, [tool]: value },
        })),
    }),
    {
      name: "omnilingo-app-store",
      partialize: (state) => ({
        activePairId: state.activePairId,
        aiProvider: state.aiProvider,
        aiApiKey: state.aiApiKey,
        aiModel: state.aiModel,
        aiCustomUrl: state.aiCustomUrl,
        flashcardsScreen: state.flashcardsScreen,
        selectedDeck: state.selectedDeck,
        reviewDeck: state.reviewDeck,
        createdDecks: state.createdDecks,
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
