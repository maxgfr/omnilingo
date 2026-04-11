import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles, Volume2, AlertTriangle, Search, Settings as SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";

import { useApp } from "../store/AppContext";
import { useAppStore, selectIsAiConfigured } from "../store/useAppStore";
import { useFeaturePair } from "../lib/useFeaturePair";
import ExamplePreview from "../components/ui/ExamplePreview";
import RecentSearches from "../components/ui/RecentSearches";
import { DICTIONARY_EXAMPLE } from "../lib/exampleData";
import { useExampleTranslations } from "../lib/useExampleTranslations";

import { formatMessage } from "../lib/markdown";
import { cachedAskAi, getCachedResult, addToHistory } from "../lib/ai-cache";

export default function Dictionary() {
  const { t } = useTranslation();
  const { languagePairs } = useApp();
  const { activePair } = useFeaturePair("dictionary");
  const isAiConfigured = useAppStore(selectIsAiConfigured);

  const cachedState = useAppStore.getState().dictionaryCache;

  // Example preview translation — shown when the search box is empty.
  const { tr: trEx, loading: trExLoading } = useExampleTranslations(
    "dictionary",
    [
      DICTIONARY_EXAMPLE.sampleQuery,
      DICTIONARY_EXAMPLE.word,
      DICTIONARY_EXAMPLE.definition,
      DICTIONARY_EXAMPLE.exampleSource,
      DICTIONARY_EXAMPLE.exampleTarget,
    ],
  );

  const [searchQuery, setSearchQuery] = useState(cachedState?.searchQuery ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [aiContent, setAiContent] = useState<string | null>(cachedState?.aiContent ?? null);
  const [aiLoading, setAiLoading] = useState(false);
  const submittedQueryRef = useRef<string>(cachedState?.searchQuery ?? "");

  // Sync view state to Zustand cache
  useEffect(() => {
    useAppStore.getState().setDictionaryCache({ searchQuery, aiContent });
  }, [searchQuery, aiContent]);

  const buildAiPrompt = useCallback((query: string) => {
    if (!activePair) return "";
    const nativeLang = activePair.source_name;
    const learningLang = activePair.target_name;

    return `You are a bilingual dictionary assistant for a ${nativeLang} speaker who is learning ${learningLang}.

The user looked up the word: "${query}"

Auto-detect whether the word is ${nativeLang} or ${learningLang} from spelling. Write your entire answer in ${nativeLang} (the user's native language). Use ${learningLang} only when quoting words, phrases, or example sentences.

Output STRICT markdown with these exact sections. ALL section headings MUST be in ${nativeLang}:

## Translation
1-3 short translations on a single line. If the word is ${nativeLang}, give the ${learningLang} equivalent; if it is ${learningLang}, give the ${nativeLang} equivalent.

## Grammar
Part of speech, gender, plural, conjugation notes, register — in ${nativeLang}.

## Examples
Exactly 3 short example sentences. Format EACH as:
> *${learningLang} sentence* — ${nativeLang} translation

## Usage
2-3 bullets in ${nativeLang} about register, common collocations, idioms, or false friends.

## Synonyms / Antonyms
Synonyms and antonyms in ${learningLang}, each followed by its ${nativeLang} gloss in parentheses.

Rules:
- Translate the section headings themselves into ${nativeLang}.
- Be concise. No preamble, no closing remarks, no code fences.
- Every ${learningLang} word or sentence MUST be followed by its ${nativeLang} translation.
- Omit any section that has no meaningful content.`;
  }, [activePair]);

  const handleLookup = useCallback(async (rawQuery?: string) => {
    const query = (rawQuery ?? searchQuery).trim();
    if (!query || !activePair || aiLoading) return;
    submittedQueryRef.current = query;
    setAiLoading(true);
    setAiContent(null);
    try {
      addToHistory(activePair.id, "dictionary", query);
      const result = await cachedAskAi("dictionary", query, activePair.id, buildAiPrompt(query));
      setAiContent(result);
    } catch (err) {
      setAiContent(`${t("common.error")}: ${err}`);
    } finally {
      setAiLoading(false);
    }
  }, [searchQuery, activePair, aiLoading, buildAiPrompt, t]);

  // Restore cached AI exploration when re-mounting with the same query so
  // navigating away and back doesn't pay the AI round-trip again.
  useEffect(() => {
    if (!activePair || !submittedQueryRef.current || aiContent) return;
    const cached = getCachedResult("dictionary", submittedQueryRef.current, activePair.id);
    if (cached) setAiContent(cached);
  }, [activePair, aiContent]);

  const speak = useCallback((text: string, lang?: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    speechSynthesis.speak(utterance);
  }, []);

  // No language pair yet → CTA pointing to Settings.
  if (languagePairs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("dictionary.title")} />
        <div className="text-center py-10 space-y-6">
          <SettingsIcon size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {t("dictionary.noPairsYet")}
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
          >
            <SettingsIcon size={14} />
            {t("nav.settings")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("dictionary.title")} subtitle={t("dictionary.lookupHint")} />

      {/* Search bar with recent-searches dropdown when focused & empty */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setShowHistory(false);
              handleLookup();
            }
          }}
          onFocus={() => !searchQuery.trim() && setShowHistory(true)}
          onBlur={() => setTimeout(() => setShowHistory(false), 150)}
          placeholder={t("dictionary.searchPlaceholder")}
          className="w-full pl-10 pr-32 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-gray-400"
        />
        <button
          onClick={() => handleLookup()}
          disabled={!searchQuery.trim() || aiLoading || !isAiConfigured}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {t("dictionary.lookup")}
        </button>
        {activePair && (
          <RecentSearches
            tool="dictionary"
            pairId={activePair.id}
            visible={showHistory && !searchQuery.trim()}
            onSelect={(q) => {
              setSearchQuery(q);
              setShowHistory(false);
              handleLookup(q);
            }}
          />
        )}
      </div>

      {!isAiConfigured && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">{t("settings.configureAi")}</p>
        </div>
      )}

      {/* Empty state preview — shown when nothing has been looked up yet. */}
      {!aiContent && !aiLoading && (
        <ExamplePreview
          loading={trExLoading}
          onClick={() => {
            const sample = trEx(DICTIONARY_EXAMPLE.sampleQuery);
            setSearchQuery(sample);
            handleLookup(sample);
          }}
        >
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4 space-y-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {trEx(DICTIONARY_EXAMPLE.word)}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 italic">
                {DICTIONARY_EXAMPLE.pos}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                {DICTIONARY_EXAMPLE.ipa}
              </span>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/30 p-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                {t("dictionary.definition")}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {trEx(DICTIONARY_EXAMPLE.definition)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/30 p-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                {t("dictionary.examples")}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-200 italic">
                &laquo; {trEx(DICTIONARY_EXAMPLE.exampleSource)} &raquo;
              </p>
            </div>
          </div>
        </ExamplePreview>
      )}

      {/* AI loading spinner */}
      {aiLoading && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={16} className="animate-spin" />
            {t("common.loading")}
          </div>
        </div>
      )}

      {/* AI definition card */}
      {aiContent && !aiLoading && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {submittedQueryRef.current}
            </h2>
            <button
              onClick={() => speak(submittedQueryRef.current, activePair?.target_lang)}
              className="p-1 rounded-full text-gray-400 hover:text-amber-500 transition-colors"
              title="Pronounce"
            >
              <Volume2 size={16} />
            </button>
          </div>
          <div
            className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5"
            dangerouslySetInnerHTML={{ __html: formatMessage(aiContent) }}
          />
        </div>
      )}
    </div>
  );
}
