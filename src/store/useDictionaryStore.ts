import { create } from "zustand";

interface DictionaryState {
  searchQuery: string;
  filterLevel: string | null;
  filterCategory: string | null;
  showFilters: boolean;
  showFavoritesOnly: boolean;
  setSearchQuery: (q: string) => void;
  setFilterLevel: (l: string | null) => void;
  setFilterCategory: (c: string | null) => void;
  setShowFilters: (s: boolean) => void;
  setShowFavoritesOnly: (s: boolean) => void;
  reset: () => void;
}

const initialState = {
  searchQuery: "",
  filterLevel: null as string | null,
  filterCategory: null as string | null,
  showFilters: false,
  showFavoritesOnly: false,
};

export const useDictionaryStore = create<DictionaryState>((set) => ({
  ...initialState,
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterLevel: (filterLevel) => set({ filterLevel }),
  setFilterCategory: (filterCategory) => set({ filterCategory }),
  setShowFilters: (showFilters) => set({ showFilters }),
  setShowFavoritesOnly: (showFavoritesOnly) => set({ showFavoritesOnly }),
  reset: () => set(initialState),
}));
