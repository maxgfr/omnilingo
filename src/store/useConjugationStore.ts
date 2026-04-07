import { create } from "zustand";

type Mode = "random" | "byTense" | "byVerb";

interface ConjugationState {
  mode: Mode;
  searchQuery: string;
  selectedTense: string;
  setMode: (m: Mode) => void;
  setSearchQuery: (q: string) => void;
  setSelectedTense: (t: string) => void;
  reset: () => void;
}

const initialState = {
  mode: "random" as Mode,
  searchQuery: "",
  selectedTense: "",
};

export const useConjugationStore = create<ConjugationState>((set) => ({
  ...initialState,
  setMode: (mode) => set({ mode }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedTense: (selectedTense) => set({ selectedTense }),
  reset: () => set(initialState),
}));
