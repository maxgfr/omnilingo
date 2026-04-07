import { useState } from "react";
import { useApp } from "../store/AppContext";
import type { LanguagePair } from "../types";

export function useFeaturePair(feature: string) {
  const { languagePairs } = useApp();

  const pairKey = `omnilingo-pair-${feature}`;

  const [selectedId, setSelectedId] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(pairKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Resolve active pair: selected > first available
  const resolve = (): LanguagePair | null => {
    if (selectedId != null) {
      const found = languagePairs.find((p) => p.id === selectedId);
      if (found) return found;
    }
    return languagePairs[0] ?? null;
  };

  const activePair = resolve();

  const switchPair = (pairId: number) => {
    setSelectedId(pairId);
    localStorage.setItem(pairKey, JSON.stringify(pairId));
  };

  return { activePair, switchPair };
}
