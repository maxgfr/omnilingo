import { useAppStore, selectActivePair } from "../store/useAppStore";
import type { LanguagePair } from "../types";

/**
 * Compatibility hook — delegates to the global Zustand store.
 * All features share a single active pair now.
 */
export function useFeaturePair(_feature: string): {
  activePair: LanguagePair | null;
  switchPair: (pairId: number) => void;
} {
  const activePair = useAppStore(selectActivePair);
  const switchPair = useAppStore((s) => s.switchPair);

  return { activePair, switchPair };
}
