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

import { formatMessage } from "../lib/markdown";
import { levelColors, genderBadges, parseTargetWord, formatDefinition, normalizeForSearch, extractTranslationsWithWordSet } from "../lib/wordUtils";
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

  // All words loaded in memory
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState(cachedState?.searchQuery ?? "");
  const [deferredQuery, setDeferredQuery] = useState(searchQuery);
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

  // Build per-pair source_word sets for cross-referencing translations
  const pairWordSets = useMemo(() => {
    const sets = new Map<number, Set<string>>();
    for (const w of allWords) {
      let s = sets.get(w.language_pair_id);
      if (!s) { s = new Set(); sets.set(w.language_pair_id, s); }
      s.add(normalizeForSearch(w.source_word));
    }
    return sets;
  }, [allWords]);

  // Resolve translation/definition for a word.
  //
  // Strategy: when a reverse-pair word set is available, ALWAYS run the
  // word-set extraction first. This catches cases like "be asleep sleep"
  // where parseTargetWord would otherwise return the whole string as a
  // single translation just because there are no semicolons.
  //
  // We only fall back to the parseTargetWord output if the extraction
  // didn't find any reverse-pair matches.
  const resolveTranslation = useCallback((word: Word, parsed: ReturnType<typeof parseTargetWord>) => {
    const oppositePairId = word.language_pair_id === activePair?.id ? reversePairId : activePair?.id;
    const oppositeSet = oppositePairId != null ? pairWordSets.get(oppositePairId) : undefined;

    if (oppositeSet && oppositeSet.size > 0 && parsed.clean.length > 0) {
      const extracted = extractTranslationsWithWordSet(parsed.clean, oppositeSet);
      // Only use the extraction result when it found at least one match;
      // otherwise the parsed semicolon split is more accurate.
      if (extracted.translation) {
        return {
          translation: extracted.translation,
          definition: extracted.definition ?? parsed.definition,
        };
      }
    }

    return { translation: parsed.translation, definition: parsed.definition };
  }, [activePair, reversePairId, pairWordSets]);

  // Client-side search
  const filteredWords = useMemo(() => {
    const query = deferredQuery.trim();
    if (!query) return allWords;

    const normQuery = normalizeForSearch(query);

    // Score: exact > prefix > contains
    const matches: Array<{ word: Word; score: number }> = [];
    for (const { word, normSource, normTarget } of indexedWords) {
      let score = -1;
      if (normSource === normQuery || normTarget === normQuery) {
        score = 0;
      } else if (normSource.startsWith(normQuery) || normTarget.startsWith(normQuery)) {
        score = 1;
      } else if (normSource.includes(normQuery) || normTarget.includes(normQuery)) {
        score = 2;
      }
      if (score >= 0) {
        matches.push({ word, score });
      }
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

  const handleAskAi = useCallback(async (word: Word) => {
    if (!activePair) return;
    setAiLoading(true);
    setAiContent(null);
    try {
      // Convention: activePair.source_name = user's native, activePair.target_name = language being learned.
      // The word being looked up may belong to either direction (source pair or its reverse).
      // Find the actual pair the word belongs to so we know what language the word is in.
      const nativeLang = activePair.source_name;
      const learningLang = activePair.target_name;
      const wordPair = languagePairs.find((p) => p.id === word.language_pair_id);
      const wordLang = wordPair?.source_name ?? learningLang;
      const isWordInLearningLang = wordLang !== nativeLang;

      const prompt = `You are a bilingual dictionary assistant for a ${nativeLang} speaker who is learning ${learningLang}.

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

      const result = await bridge.askAi(prompt);
      setAiContent(result);
    } catch (err) {
      setAiContent(`${t("common.error")}: ${err}`);
    } finally {
      setAiLoading(false);
    }
  }, [activePair, languagePairs, t]);

  const openWordDetail = useCallback((word: Word) => {
    setSelectedWord(word);
    setAiContent(null);
    setAiLoading(false);
  }, []);

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

      {/* Search bar */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("dictionary.searchPlaceholder")}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-gray-400"
        />
      </div>

      {deferredQuery.trim() && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("dictionary.resultsFor", { count: filteredWords.length, query: deferredQuery })}
        </p>
      )}

      {/* Word list */}
      {filteredWords.length === 0 && !loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-lg font-medium">{t("dictionary.noWordsFound")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleWords.map((word) => {
            const gender = word.gender ? genderBadges[word.gender] : null;
            const isSelected = selectedWord?.id === word.id;
            const parsed = parseTargetWord(word.target_word, word.category, word.tags);
            const resolved = resolveTranslation(word, parsed);

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
                      {(resolved.translation || parsed.clean) && (
                        <span className="text-sm text-amber-600 dark:text-amber-400 truncate">
                          {resolved.translation || parsed.clean}
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

                    {/* Translation (short) */}
                    {resolved.translation && (
                      <div className="rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 p-3">
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1.5">
                          {t("dictionary.translation")}
                        </p>
                        <div className="space-y-1">
                          {formatDefinition(resolved.translation).map((def, i) => (
                            <p key={i} className="text-sm text-gray-700 dark:text-gray-200">
                              {formatDefinition(resolved.translation!).length > 1 && (
                                <span className="text-amber-500 dark:text-amber-400 mr-1.5 font-medium">{i + 1}.</span>
                              )}
                              {def}
                            </p>
                          ))}
                        </div>
                        {word.plural && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                            {t("dictionary.plural")} : {word.plural}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Definition (long descriptions) */}
                    {resolved.definition && (
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/30 p-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                          {t("dictionary.definition")}
                        </p>
                        <div className="space-y-1">
                          {formatDefinition(resolved.definition).map((def, i) => (
                            <p key={i} className="text-sm text-gray-600 dark:text-gray-300">
                              {formatDefinition(resolved.definition!).length > 1 && (
                                <span className="text-gray-400 dark:text-gray-500 mr-1.5 font-medium">{i + 1}.</span>
                              )}
                              {def}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fallback: show clean text if no translation/definition split */}
                    {!resolved.translation && !resolved.definition && parsed.clean && (
                      <div className="rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 p-3">
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1.5">
                          {t("dictionary.translation")}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-200">{parsed.clean}</p>
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
                            className="prose prose-sm dark:prose-invert max-w-none text-sm [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>p]:my-1.5 [&>ul]:my-1.5 [&>ol]:my-1.5"
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
