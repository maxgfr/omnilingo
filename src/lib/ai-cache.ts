import * as bridge from "./bridge";

// ── AI Response Cache ────────────────────────────────────────────────

const CACHE_PREFIX = "omnilingo-ai-cache";

export function getCachedResult(tool: string, input: string, pairId: number): string | null {
  const key = `${CACHE_PREFIX}-${tool}-${pairId}-${input.trim().toLowerCase()}`;
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;
    const { result, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(key);
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

function setCachedResult(tool: string, input: string, pairId: number, result: string): void {
  const key = `${CACHE_PREFIX}-${tool}-${pairId}-${input.trim().toLowerCase()}`;
  try {
    sessionStorage.setItem(key, JSON.stringify({ result, timestamp: Date.now() }));
  } catch { /* storage full — ignore */ }
}

/** Call AI with sessionStorage cache (24h TTL). */
export async function cachedAskAi(tool: string, input: string, pairId: number, prompt: string): Promise<string> {
  const cached = getCachedResult(tool, input, pairId);
  if (cached) return cached;
  const result = await bridge.askAi(prompt);
  setCachedResult(tool, input, pairId, result);
  return result;
}

// ── Search History ───────────────────────────────────────────────────

const HISTORY_KEY = "omnilingo-tool-history";
const MAX_HISTORY = 20;

export interface HistoryEntry {
  tool: string;
  query: string;
  timestamp: number;
}

export function getSearchHistory(pairId: number): HistoryEntry[] {
  try {
    const raw = sessionStorage.getItem(`${HISTORY_KEY}-${pairId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToHistory(pairId: number, tool: string, query: string): void {
  const history = getSearchHistory(pairId);
  const filtered = history.filter(
    (h) => !(h.tool === tool && h.query.toLowerCase() === query.toLowerCase()),
  );
  filtered.unshift({ tool, query, timestamp: Date.now() });
  try {
    sessionStorage.setItem(`${HISTORY_KEY}-${pairId}`, JSON.stringify(filtered.slice(0, MAX_HISTORY)));
  } catch { /* ignore */ }
}

// ── Enriched Prompt Context ──────────────────────────────────────────

/** Build extra context from recent errors + recent searches for richer AI prompts. */
export async function getPromptContext(pairId: number): Promise<string> {
  let ctx = "";
  try {
    const errors = await bridge.readMemoryFile("errors.md");
    if (errors) {
      ctx += `\nRecent student errors (avoid these in examples, or address them):\n${errors.slice(0, 400)}\n`;
    }
  } catch { /* no errors file */ }
  // Include recent search themes
  const history = getSearchHistory(pairId);
  if (history.length > 0) {
    const recentWords = history.slice(0, 5).map((h) => h.query).join(", ");
    ctx += `\nRecent topics the student explored: ${recentWords}\n`;
  }
  return ctx;
}
