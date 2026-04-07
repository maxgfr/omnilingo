import { create } from "zustand";

type Screen = "decks" | "deck-detail" | "review";

interface FlashcardsState {
  screen: Screen;
  selectedDeck: string | null;
  reviewDeck: string | null; // null = review all due
  setScreen: (s: Screen) => void;
  openDeck: (name: string) => void;
  startReview: (deck: string | null) => void;
  goHome: () => void;
}

export const useFlashcardsStore = create<FlashcardsState>((set) => ({
  screen: "decks",
  selectedDeck: null,
  reviewDeck: null,
  setScreen: (screen) => set({ screen }),
  openDeck: (name) => set({ screen: "deck-detail", selectedDeck: name }),
  startReview: (deck) => set({ screen: "review", reviewDeck: deck }),
  goHome: () => set({ screen: "decks", selectedDeck: null, reviewDeck: null }),
}));
