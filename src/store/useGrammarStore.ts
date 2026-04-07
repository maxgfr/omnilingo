import { create } from "zustand";

interface GrammarState {
  selectedTopicId: string | number | null;
  searchQuery: string;
  showAiLesson: boolean;
  aiTopic: string;
  setSelectedTopicId: (id: string | number | null) => void;
  setSearchQuery: (q: string) => void;
  setShowAiLesson: (s: boolean) => void;
  setAiTopic: (t: string) => void;
  reset: () => void;
}

const initialState = {
  selectedTopicId: null as string | number | null,
  searchQuery: "",
  showAiLesson: false,
  aiTopic: "",
};

export const useGrammarStore = create<GrammarState>((set) => ({
  ...initialState,
  setSelectedTopicId: (selectedTopicId) => set({ selectedTopicId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setShowAiLesson: (showAiLesson) => set({ showAiLesson }),
  setAiTopic: (aiTopic) => set({ aiTopic }),
  reset: () => set(initialState),
}));
