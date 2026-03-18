import { z } from "zod";

// ── Onboarding state schema ─────────────────────────────────────────

export const OnboardingStateSchema = z.object({
  step: z.number().min(0).max(5),
  nativeLang: z.string().nullable(),
  targetLang: z.string().nullable(),
  level: z.string().nullable(),
  aiProvider: z.string().default("claude-code"),
  aiApiKey: z.string().default(""),
  completed: z.boolean().default(false),
});

export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

// ── Constants ───────────────────────────────────────────────────────

export const LANGUAGES = [
  { code: "fr", code3: "fra", name: "Fran\u00e7ais", flag: "\uD83C\uDDEB\uD83C\uDDF7" },
  { code: "en", code3: "eng", name: "English", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { code: "de", code3: "deu", name: "Deutsch", flag: "\uD83C\uDDE9\uD83C\uDDEA" },
  { code: "es", code3: "spa", name: "Espa\u00f1ol", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
  { code: "it", code3: "ita", name: "Italiano", flag: "\uD83C\uDDEE\uD83C\uDDF9" },
  { code: "pt", code3: "por", name: "Portugu\u00eas", flag: "\uD83C\uDDF5\uD83C\uDDF9" },
  { code: "nl", code3: "nld", name: "Nederlands", flag: "\uD83C\uDDF3\uD83C\uDDF1" },
  { code: "ru", code3: "rus", name: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439", flag: "\uD83C\uDDF7\uD83C\uDDFA" },
  { code: "ja", code3: "jpn", name: "\u65e5\u672c\u8a9e", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { code: "zh", code3: "zho", name: "\u4e2d\u6587", flag: "\uD83C\uDDE8\uD83C\uDDF3" },
  { code: "ko", code3: "kor", name: "\ud55c\uad6d\uc5b4", flag: "\uD83C\uDDF0\uD83C\uDDF7" },
  { code: "ar", code3: "ara", name: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", flag: "\uD83C\uDDF8\uD83C\uDDE6" },
  { code: "tr", code3: "tur", name: "T\u00fcrk\u00e7e", flag: "\uD83C\uDDF9\uD83C\uDDF7" },
  { code: "pl", code3: "pol", name: "Polski", flag: "\uD83C\uDDF5\uD83C\uDDF1" },
  { code: "sv", code3: "swe", name: "Svenska", flag: "\uD83C\uDDF8\uD83C\uDDEA" },
] as const;

export type Language = (typeof LANGUAGES)[number];

export const LEVELS = [
  { value: "A1", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-700", hover: "hover:border-emerald-400" },
  { value: "A2", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-700", hover: "hover:border-blue-400" },
  { value: "B1", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-700", hover: "hover:border-amber-400" },
  { value: "B2", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-700", hover: "hover:border-purple-400" },
] as const;

export type Level = (typeof LEVELS)[number];

export const AI_PROVIDERS = [
  { value: "claude-code", label: "Claude Code (local)", noKey: true },
  { value: "anthropic", label: "Anthropic", noKey: false },
  { value: "openai", label: "OpenAI", noKey: false },
  { value: "gemini", label: "Google Gemini", noKey: false },
  { value: "ollama", label: "Ollama (local)", noKey: true },
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

// ── Completion helpers ──────────────────────────────────────────────

export function isOnboardingComplete(state: OnboardingState): boolean {
  return state.completed;
}

const ONBOARDING_KEY = "omnilingo-onboarding-done";

export function markOnboardingDone(): void {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

export function isOnboardingDone(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function resetOnboarding(): void {
  localStorage.removeItem(ONBOARDING_KEY);
}

// ── Dictionary sorting helper ───────────────────────────────────────

export function findLangCode3(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.code3 || "";
}

export function scoreDictRelevance(
  dictSourceLang: string,
  dictTargetLang: string,
  nativeLang3: string,
  targetLang3: string,
): number {
  const exactMatch =
    (dictSourceLang === targetLang3 && dictTargetLang === nativeLang3) ||
    (dictSourceLang === nativeLang3 && dictTargetLang === targetLang3);
  if (exactMatch) return 0;

  const partialMatch =
    dictSourceLang === targetLang3 ||
    dictTargetLang === targetLang3 ||
    dictSourceLang === nativeLang3 ||
    dictTargetLang === nativeLang3;
  if (partialMatch) return 1;

  return 2;
}

export function filterDictionaries<T extends { source_lang: string; target_lang: string; source_name: string; target_name: string }>(
  dicts: T[],
  search: string,
  nativeLang3: string,
  targetLang3: string,
): T[] {
  return dicts
    .filter((d) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        d.source_name.toLowerCase().includes(q) ||
        d.target_name.toLowerCase().includes(q) ||
        d.source_lang.toLowerCase().includes(q) ||
        d.target_lang.toLowerCase().includes(q)
      );
    })
    .sort(
      (a, b) =>
        scoreDictRelevance(a.source_lang, a.target_lang, nativeLang3, targetLang3) -
        scoreDictRelevance(b.source_lang, b.target_lang, nativeLang3, targetLang3),
    );
}
