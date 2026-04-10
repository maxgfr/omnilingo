import { useEffect, useMemo, useState } from "react";
import { getCachedTranslations, getTranslatedStrings, tr } from "./exampleTranslations";
import { useAppStore, selectIsAiConfigured } from "../store/useAppStore";
import { useFeaturePair } from "./useFeaturePair";

/**
 * Translates English example strings into the user's active target language.
 * Falls back to English when there is no active pair, AI is not configured,
 * or the translation request fails. The translation is fetched once per
 * (pair, target language) and cached in localStorage.
 *
 * Returns:
 * - `tr(text)`: lookup function — the translated string, or the English original
 *   when no translation is available yet.
 * - `loading`: true while an AI translation request is in flight (use this to
 *   show a spinner / disable the example preview).
 */
export function useExampleTranslations(
  featureName: string,
  strings: string[],
): { tr: (text: string) => string; loading: boolean } {
  const { activePair } = useFeaturePair(featureName);
  const isAiConfigured = useAppStore(selectIsAiConfigured);

  // Stable string-key so we don't re-fire on identical-content arrays
  const stringsKey = useMemo(() => strings.join("\u0001"), [strings]);

  // Seed from sync cache so the first paint shows translated content
  // immediately when it's already cached.
  const [map, setMap] = useState<Record<string, string> | null>(() => {
    if (!activePair || !isAiConfigured || strings.length === 0) return null;
    return getCachedTranslations(activePair.id, activePair.target_name, strings);
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!activePair || !isAiConfigured || strings.length === 0) return false;
    return getCachedTranslations(activePair.id, activePair.target_name, strings) === null;
  });

  useEffect(() => {
    if (!activePair || !isAiConfigured || strings.length === 0) {
      setMap(null);
      setLoading(false);
      return;
    }

    // Sync cache hit — no network needed
    const cached = getCachedTranslations(activePair.id, activePair.target_name, strings);
    if (cached) {
      setMap(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getTranslatedStrings(activePair.id, activePair.target_name, strings)
      .then((result) => {
        if (cancelled) return;
        setMap(result);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setMap(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePair?.id, activePair?.target_name, isAiConfigured, stringsKey]);

  return {
    tr: (text: string) => tr(text, map),
    loading,
  };
}
