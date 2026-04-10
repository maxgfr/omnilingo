import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Download,
  X,
  Sparkles,
  Volume2,
  AlertTriangle,
} from "lucide-react";
import { Search } from "lucide-react";
import Spinner from "../components/ui/Spinner";
import PageHeader from "../components/ui/PageHeader";

import { useApp } from "../store/AppContext";
import { useAppStore, selectIsAiConfigured, selectReversePairId } from "../store/useAppStore";
import { useFeaturePair } from "../lib/useFeaturePair";
import LanguagePackDownloader from "../components/LanguagePackDownloader";
import ExamplePreview from "../components/ui/ExamplePreview";
import RecentSearches from "../components/ui/RecentSearches";
import { DICTIONARY_EXAMPLE } from "../lib/exampleData";
import { useExampleTranslations } from "../lib/useExampleTranslations";

import { formatMessage } from "../lib/markdown";
import { cachedAskAi, getCachedResult, addToHistory } from "../lib/ai-cache";
import { levelColors, genderBadges, parseTargetWord, normalizeForSearch, tokenizeSearchQuery } from "../lib/wordUtils";
import * as bridge from "../lib/bridge";
import type { Word } from "../types";

const RENDER_PAGE = 80;

// Module-level cache to avoid reloading 50k+ words on every tab switch
let _dictCache: { key: string; words: Word[] } | null = null;

export default function Dictionary() {
  const { t } = useTranslation();
  const { languagePairs, reloadSettings } = useApp();
  const { activePair } = useFeaturePair("dictionary");
  const isAiConfigured = useAppStore(selectIsAiConfigured);
  const reversePairId = useAppStore(selectReversePairId);

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

  // All words loaded in memory
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState(cachedState?.searchQuery ?? "");
  const [deferredQuery, setDeferredQuery] = useState(searchQuery);
  const [showHistory, setShowHistory] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // How many filtered results to render
  const [renderLimit, setRenderLimit] = useState(RENDER_PAGE);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDeferredQuery(searchQuery), 150);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [aiContent, setAiContent] = useState<string | null>(cachedState?.aiContent ?? null);
  const [aiLoading, setAiLoading] = useState(false);

  // Sync view state to Zustand cache
  useEffect(() => {
    useAppStore.getState().setDictionaryCache({
      searchQuery,
      selectedWordId: selectedWord?.id ?? null,
      aiContent,
    });
  }, [searchQuery, selectedWord, aiContent]);

  // Pre-compute normalized fields for all words (once on load)
  const indexedWords = useMemo(() => {
    return allWords.map((w) => ({
      word: w,
      normSource: normalizeForSearch(w.source_word),
      normTarget: normalizeForSearch(w.target_word),
    }));
  }, [allWords]);

  // Client-side search
  const filteredWords = useMemo(() => {
    const query = deferredQuery.trim();
    if (!query) return allWords;

    // Tokens with leading articles ("das", "le", "the"…) stripped, so a
    // query like "das haus" still finds "haus". Falls back to the full
    // normalized query if every token is a stopword.
    const tokens = tokenizeSearchQuery(query);
    if (tokens.length === 0) return allWords;

    // The "primary" token is the longest meaningful one — used for
    // exact/prefix scoring so a multi-word query like "das haus" still
    // ranks "haus" as an exact match.
    const primary = tokens.reduce((a, b) => (b.length > a.length ? b : a));

    // Score: exact > prefix > contains. A word matches only if EVERY
    // meaningful token appears in either source or target — this keeps
    // multi-word queries precise instead of unioning unrelated results.
    const matches: Array<{ word: Word; score: number }> = [];
    for (const { word, normSource, normTarget } of indexedWords) {
      const allTokensMatch = tokens.every(
        (t) => normSource.includes(t) || normTarget.includes(t),
      );
      if (!allTokensMatch) continue;

      let score: number;
      if (normSource === primary || normTarget === primary) {
        score = 0;
      } else if (normSource.startsWith(primary) || normTarget.startsWith(primary)) {
        score = 1;
      } else {
        score = 2;
      }
      matches.push({ word, score });
    }

    matches.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.word.source_word.length - b.word.source_word.length;
    });

    return matches.map((m) => m.word);
  }, [allWords, indexedWords, deferredQuery]);

  // Reset render limit when filter changes
  useEffect(() => {
    setRenderLimit(RENDER_PAGE);
  }, [deferredQuery]);

  const visibleWords = useMemo(
    () => filteredWords.slice(0, renderLimit),
    [filteredWords, renderLimit],
  );
  const hasMore = renderLimit < filteredWords.length;

  // Load ALL words into memory on pair change (with module-level cache)
  useEffect(() => {
    const cache = useAppStore.getState().dictionaryCache;
    if (!cache) {
      setSelectedWord(null);
      setAiContent(null);
      setSearchQuery("");
    }

    if (!activePair) {
      setLoading(false);
      return;
    }

    const cacheKey = `${activePair.id}-${reversePairId ?? ""}`;

    // Use module-level cache if pair hasn't changed
    if (_dictCache && _dictCache.key === cacheKey) {
      setAllWords(_dictCache.words);
      setLoading(false);
      // Restore selected word
      const c = useAppStore.getState().dictionaryCache;
      if (c?.selectedWordId != null) {
        const restored = _dictCache.words.find((w: Word) => w.id === c.selectedWordId);
        if (restored) setSelectedWord(restored);
      }
      return;
    }

    setLoading(true);
    bridge.getAllDictionaryWords(activePair.id, reversePairId ?? undefined)
      .then((words) => {
        _dictCache = { key: cacheKey, words };
        setAllWords(words);

        // Restore selected word from cache
        const c = useAppStore.getState().dictionaryCache;
        if (c?.selectedWordId != null) {
          const restored = words.find((w: Word) => w.id === c.selectedWordId);
          if (restored) setSelectedWord(restored);
        }
      })
      .catch((err) => console.error("Failed to load dictionary:", err))
      .finally(() => setLoading(false));
  }, [activePair, reversePairId]);

  const buildAiPrompt = useCallback((word: Word) => {
    if (!activePair) return "";
    const nativeLang = activePair.source_name;
    const learningLang = activePair.target_name;
    const wordPair = languagePairs.find((p) => p.id === word.language_pair_id);
    const wordLang = wordPair?.source_name ?? learningLang;
    const isWordInLearningLang = wordLang !== nativeLang;

    return `You are a bilingual dictionary assistant for a ${nativeLang} speaker who is learning ${learningLang}.

The user looked up the ${wordLang} word: "${word.source_word}"
${word.target_word ? `Known translation: ${word.target_word}` : ""}

Write your entire answer in ${nativeLang} (the user's native language). Use ${learningLang} only when quoting words, phrases, or example sentences.

Output STRICT markdown with these exact sections. ALL section headings MUST be in ${nativeLang}:

## ${isWordInLearningLang ? `Translation in ${nativeLang}` : `${learningLang} equivalent`}
1-3 short translations on a single line.

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
  }, [activePair, languagePairs]);

  const handleAskAi = useCallback(async (word: Word) => {
    if (!activePair) return;
    setAiLoading(true);
    setAiContent(null);
    try {
      addToHistory(activePair.id, "dictionary", word.source_word);
      const result = await cachedAskAi("dictionary", word.source_word, activePair.id, buildAiPrompt(word));
      setAiContent(result);
    } catch (err) {
      setAiContent(`${t("common.error")}: ${err}`);
    } finally {
      setAiLoading(false);
    }
  }, [activePair, buildAiPrompt, t]);

  // Restore cached AI exploration when re-opening a word, so the user
  // doesn't pay the AI round-trip twice for the same lookup.
  const openWordDetail = useCallback((word: Word) => {
    setSelectedWord(word);
    setAiLoading(false);
    if (activePair) {
      const cached = getCachedResult("dictionary", word.source_word, activePair.id);
      setAiContent(cached);
    } else {
      setAiContent(null);
    }
  }, [activePair]);

  const closeWordDetail = useCallback(() => {
    setSelectedWord(null);
    setAiContent(null);
    setAiLoading(false);
  }, []);

  // IntersectionObserver for progressive rendering
  useEffect(() => {
    if (!hasMore || !loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setRenderLimit((prev) => prev + RENDER_PAGE);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore]);

  // Keyboard navigation — skip when focus is on any interactive element
  // to avoid triggering arrow/Escape shortcuts while the user is clicking a button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx = selectedWord ? visibleWords.findIndex((w) => w.id === selectedWord.id) : -1;
        let nextIdx: number;
        if (e.key === "ArrowDown") {
          nextIdx = currentIdx < visibleWords.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : visibleWords.length - 1;
        }
        if (visibleWords[nextIdx]) {
          openWordDetail(visibleWords[nextIdx]);
        }
      } else if (e.key === "Escape" && selectedWord) {
        closeWordDetail();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [visibleWords, selectedWord, openWordDetail, closeWordDetail]);

  const speak = useCallback((text: string, lang?: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    speechSynthesis.speak(utterance);
  }, []);

  if (loading && allWords.length === 0) {
    return <Spinner fullPage />;
  }

  if (languagePairs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("dictionary.title")} />
        <div className="text-center py-10 space-y-6">
          <Download size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {t("dictionary.noPacksYet")}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("dictionary.noPacksDescription")}
          </p>
          <div className="max-w-md mx-auto">
            <LanguagePackDownloader
              existingPairs={languagePairs}
              onDownloaded={async () => { await reloadSettings(); }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("dictionary.title")} subtitle={t("dictionary.wordsAvailable", { count: allWords.length })} />

      {/* Search bar with recent-searches dropdown when focused & empty */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => !searchQuery.trim() && setShowHistory(true)}
          onBlur={() => setTimeout(() => setShowHistory(false), 150)}
          placeholder={t("dictionary.searchPlaceholder")}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-gray-400"
        />
        {activePair && (
          <RecentSearches
            tool="dictionary"
            pairId={activePair.id}
            visible={showHistory && !searchQuery.trim()}
            onSelect={(q) => { setSearchQuery(q); setShowHistory(false); }}
          />
        )}
      </div>

      {deferredQuery.trim() && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("dictionary.resultsFor", { count: filteredWords.length, query: deferredQuery })}
        </p>
      )}

      {/* Example preview — shown when the search box is empty so users
          immediately see what a result looks like (mirrors every other view). */}
      {!deferredQuery.trim() && (
        <ExamplePreview
          loading={trExLoading}
          onClick={() => setSearchQuery(trEx(DICTIONARY_EXAMPLE.sampleQuery))}
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

      {/* Word list — only shown once the user has typed a query.
          With no query the dictionary contains 50k+ entries; rendering them
          all is both slow and noisy. */}
      {!deferredQuery.trim() ? null : filteredWords.length === 0 && !loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium">{t("dictionary.noWordsFound")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleWords.map((word) => {
            const gender = word.gender ? genderBadges[word.gender] : null;
            const isSelected = selectedWord?.id === word.id;
            const parsed = parseTargetWord(word.target_word, word.category, word.tags);
            // Preview shown next to the source word in the list row.
            // Prefer the parsed translation; otherwise show a truncated
            // definition snippet so the user gets some context. We never
            // fall back to `parsed.clean` directly because it may contain
            // the entire raw target_word including definition prose.
            const listPreview = parsed.translation
              ?? (parsed.definition ? parsed.definition.split(/[.;]/)[0].trim() : null);

            return (
              <div key={word.id}>
                {/* Word card */}
                <button
                  onClick={() => isSelected ? closeWordDetail() : openWordDetail(word)}
                  className={`w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 transition-all ${
                    isSelected
                      ? "border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10 shadow-sm"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {gender && (
                    <span className={`${gender.color} text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 uppercase`}>
                      {gender.label}
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-bold text-gray-900 dark:text-white text-sm flex-shrink-0">
                        {word.source_word}
                      </span>
                      {listPreview && (
                        <span className="text-sm text-amber-600 dark:text-amber-400 truncate">
                          {listPreview}
                        </span>
                      )}
                    </div>
                    {word.example_source && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1 italic">
                        {word.example_source}
                        {word.example_target && <span className="not-italic ml-1">— {word.example_target}</span>}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {parsed.pos && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 italic">
                        {parsed.pos}
                      </span>
                    )}
                    {word.level && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${levelColors[word.level] || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}>
                        {word.level}
                      </span>
                    )}
                  </div>
                </button>

                {/* Detail panel */}
                {isSelected && (
                  <div className="rounded-b-xl border border-t-0 border-amber-400 dark:border-amber-600 bg-white dark:bg-gray-800 px-5 py-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {word.source_word}
                        </h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); speak(word.source_word, activePair?.source_lang); }}
                          className="p-1 rounded-full text-gray-400 hover:text-amber-500 transition-colors"
                        >
                          <Volume2 size={16} />
                        </button>
                        {gender && (
                          <span className={`${gender.color} text-xs px-2 py-0.5 rounded font-bold uppercase`}>
                            {gender.label}
                          </span>
                        )}
                        {parsed.pos && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 italic">
                            {parsed.pos}
                          </span>
                        )}
                        {parsed.ipa && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                            {parsed.ipa}
                          </span>
                        )}
                      </div>
                      <button onClick={closeWordDetail} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X size={18} />
                      </button>
                    </div>

                    {/* Definition — the only structured block kept.
                        Cross-pair "translation extraction" was removed
                        because it produced false-positive matches across
                        cognates / homographs. Users get clean translations
                        from the "Explore with AI" button below. */}
                    {(parsed.definition || parsed.translation || parsed.clean) && (
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/30 p-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                          {t("dictionary.definition")}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                          {parsed.definition ?? parsed.translation ?? parsed.clean}
                        </p>
                        {word.plural && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                            {t("dictionary.plural")} : {word.plural}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Examples */}
                    {word.example_source && (
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/30 p-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                          {t("dictionary.examples")}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-200 italic">
                          &laquo; {word.example_source} &raquo;
                        </p>
                        {word.example_target && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            &laquo; {word.example_target} &raquo;
                          </p>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAskAi(word); }}
                        disabled={aiLoading || !isAiConfigured}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {aiLoading ? t("common.loading") : t("dictionary.exploreWithAi")}
                      </button>
                    </div>

                    {!isAiConfigured && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">{t("settings.configureAi")}</p>
                      </div>
                    )}

                    {(aiContent || aiLoading) && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                        {aiLoading ? (
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <Loader2 size={16} className="animate-spin" />
                            {t("common.loading")}
                          </div>
                        ) : aiContent && (
                          <div
                            className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5"
                            dangerouslySetInnerHTML={{ __html: formatMessage(aiContent) }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Infinite scroll sentinel */}
          {hasMore && (
            <div ref={loadMoreRef} className="py-4 text-center">
              <span className="text-xs text-gray-400">{renderLimit}/{filteredWords.length}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
