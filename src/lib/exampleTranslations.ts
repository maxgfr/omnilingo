// AI-translated example data, cached per language pair in localStorage.
//
// The base examples in `exampleData.ts` are written in English. When a user
// has an active language pair, we translate the strings ONCE via the AI
// provider and store the result keyed by `${pairId}`. Subsequent renders
// load instantly from the cache.

import * as bridge from "./bridge";

const STORAGE_KEY = "omnilingo-example-translations-v1";
const INFLIGHT = new Map<string, Promise<Record<string, string> | null>>();

type StringMap = Record<string, string>;

interface CachedTranslations {
  // pairId -> { english string -> translated string }
  [pairKey: string]: StringMap;
}

function loadCache(): CachedTranslations {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CachedTranslations) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: CachedTranslations): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage may be full or unavailable; ignore
  }
}

/** Stable per-pair cache key (also encodes target language so swapping pairs invalidates). */
function pairKey(pairId: number, targetLang: string): string {
  return `${pairId}:${targetLang}`;
}

/**
 * Synchronous cache lookup. Returns the cached translation map if every
 * requested string is already translated, else null. Used by the hook to
 * decide if it needs to show a loading state.
 */
export function getCachedTranslations(
  pairId: number,
  targetLangName: string,
  strings: string[],
): StringMap | null {
  if (strings.length === 0) return {};
  const cache = loadCache();
  const cached = cache[pairKey(pairId, targetLangName)];
  if (cached && strings.every((s) => s in cached)) {
    return cached;
  }
  return null;
}

/**
 * Translate a list of English strings into the user's target language via AI.
 * Returns a string-map (english -> translated). Cached per (pairId, targetLang).
 *
 * Failures are silent: callers can fall back to the original English strings.
 */
export async function getTranslatedStrings(
  pairId: number,
  targetLangName: string,
  strings: string[],
): Promise<StringMap | null> {
  if (strings.length === 0) return {};
  const key = pairKey(pairId, targetLangName);

  // Cache hit
  const cache = loadCache();
  const cached = cache[key];
  if (cached && strings.every((s) => s in cached)) {
    return cached;
  }

  // Coalesce concurrent requests for the same pair
  const inflight = INFLIGHT.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const numbered = strings.map((s, i) => `${i + 1}. ${s.replace(/\n/g, " ")}`).join("\n");
      const prompt = `Translate each numbered English line into ${targetLangName}. Preserve any **bold markers** and inline punctuation. Return ONLY the translated lines, in the same order, with the same numbering. No prose, no explanation.\n\n${numbered}`;
      const response = await bridge.askAi(prompt);

      // Parse "1. translation" lines
      const translated: StringMap = {};
      const lines = response.split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^\s*(\d+)[.)]\s*(.+?)\s*$/);
        if (!m) continue;
        const idx = parseInt(m[1], 10) - 1;
        if (idx >= 0 && idx < strings.length) {
          translated[strings[idx]] = m[2];
        }
      }
      // Fill any missing lines with the original (so callers always get a complete map)
      for (const s of strings) {
        if (!(s in translated)) translated[s] = s;
      }

      // Persist
      const fresh = loadCache();
      fresh[key] = translated;
      saveCache(fresh);
      return translated;
    } catch (err) {
      console.warn("Failed to translate examples:", err);
      return null;
    } finally {
      INFLIGHT.delete(key);
    }
  })();

  INFLIGHT.set(key, promise);
  return promise;
}

/** Apply a translation map to a value, falling back to the original on miss. */
export function tr(value: string, map: StringMap | null | undefined): string {
  if (!map) return value;
  return map[value] ?? value;
}

/** Wipe the cache. Useful when the user changes AI providers or wants to refresh examples. */
export function clearExampleTranslations(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
