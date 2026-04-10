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
 * The cache is **accumulative**: each call merges new translations into the
 * existing pair entry rather than replacing it. This is critical because
 * different views translate different string sets for the same pair — without
 * merging, switching from Grammar to Conjugation and back would wipe each
 * view's entries on every visit and trigger an AI re-fetch every time.
 *
 * Only the missing strings are sent to the AI; everything already cached is
 * reused. Failures are silent: callers can fall back to the original English.
 */
export async function getTranslatedStrings(
  pairId: number,
  targetLangName: string,
  strings: string[],
): Promise<StringMap | null> {
  if (strings.length === 0) return {};
  const key = pairKey(pairId, targetLangName);

  // Determine what's already cached vs what we still need to fetch.
  const cache = loadCache();
  const existing = cache[key] ?? {};
  const missing = strings.filter((s) => !(s in existing));

  // Fast path: every requested string is already cached.
  if (missing.length === 0) return existing;

  // Coalesce concurrent requests for the same pair + missing-strings set.
  // (Per-pair coalescing alone is wrong because two views can race with
  // disjoint missing sets; one would receive a promise that doesn't contain
  // its strings.)
  const inflightKey = `${key}|${missing.join("\u0001")}`;
  const inflight = INFLIGHT.get(inflightKey);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const numbered = missing.map((s, i) => `${i + 1}. ${s.replace(/\n/g, " ")}`).join("\n");
      const prompt = `Translate each numbered English line into ${targetLangName}. Preserve any **bold markers** and inline punctuation. Return ONLY the translated lines, in the same order, with the same numbering. No prose, no explanation.\n\n${numbered}`;
      const response = await bridge.askAi(prompt);

      // Parse "1. translation" lines
      const translated: StringMap = {};
      const lines = response.split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^\s*(\d+)[.)]\s*(.+?)\s*$/);
        if (!m) continue;
        const idx = parseInt(m[1], 10) - 1;
        if (idx >= 0 && idx < missing.length) {
          translated[missing[idx]] = m[2];
        }
      }
      // Fill any missing lines with the original (so callers always get a complete map)
      for (const s of missing) {
        if (!(s in translated)) translated[s] = s;
      }

      // Merge with existing cache so we don't drop entries from other views.
      const fresh = loadCache();
      const merged: StringMap = { ...(fresh[key] ?? {}), ...translated };
      fresh[key] = merged;
      saveCache(fresh);
      return merged;
    } catch (err) {
      console.warn("Failed to translate examples:", err);
      return null;
    } finally {
      INFLIGHT.delete(inflightKey);
    }
  })();

  INFLIGHT.set(inflightKey, promise);
  return promise;
}

/**
 * Strip inline markdown markers (**bold**, *italic*) from a string.
 *
 * The AI translation prompt asks the model to preserve `**bold markers**`,
 * but the example previews are rendered as plain text — not through a
 * markdown formatter — so leaked asterisks would show literally (e.g.
 * "**erstellen**"). Strip them at the lookup boundary so callers never
 * see markdown noise in example previews.
 */
function stripInlineMd(value: string): string {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+?)\*/g, "$1$2");
}

/** Apply a translation map to a value, falling back to the original on miss. */
export function tr(value: string, map: StringMap | null | undefined): string {
  const raw = map ? (map[value] ?? value) : value;
  return stripInlineMd(raw);
}

/** Wipe the cache. Useful when the user changes AI providers or wants to refresh examples. */
export function clearExampleTranslations(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
