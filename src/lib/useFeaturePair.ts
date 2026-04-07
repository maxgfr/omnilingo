import { useState, useEffect, useCallback } from "react";
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

  // Listen for global pair changes dispatched by the sidebar selector
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      // Only react to the global pair change event, not every storage event
      if (e.key !== "omnilingo-global-pair") return;
      try {
        const raw = localStorage.getItem(pairKey);
        const newId = raw ? JSON.parse(raw) : null;
        setSelectedId(newId);
      } catch {
        // ignore
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [pairKey]);

  // Resolve active pair: selected > first available
  const resolve = (): LanguagePair | null => {
    if (selectedId != null) {
      const found = languagePairs.find((p) => p.id === selectedId);
      if (found) return found;
    }
    return languagePairs[0] ?? null;
  };

  const activePair = resolve();

  const switchPair = useCallback(
    (pairId: number) => {
      setSelectedId(pairId);
      localStorage.setItem(pairKey, JSON.stringify(pairId));
    },
    [pairKey],
  );

  return { activePair, switchPair };
}
