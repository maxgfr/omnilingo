import { useEffect, useState, useCallback, useDeferredValue } from "react";
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
import ExamplePreview from "../components/ui/ExamplePreview";
import { FLASHCARD_EXAMPLE } from "../lib/exampleData";
import { useApp } from "../store/AppContext";
import { useAppStore, selectIsAiConfigured, selectReversePairId } from "../store/useAppStore";
import { useFeaturePair } from "../lib/useFeaturePair";
import LanguagePackDownloader from "../components/LanguagePackDownloader";
import FavoriteButton from "../components/FavoriteButton";
import DeckPopover from "../components/DeckPopover";
import { formatMessage } from "../lib/markdown";
import * as bridge from "../lib/bridge";
import type { Word, DeckInfo, FavoriteWord } from "../types";

const PAGE_SIZE = 50;

const levelColors: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  A2: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  B1: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  B2: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const genderBadges: Record<string, { label: string; color: string }> = {
  m: { label: "der", color: "bg-blue-500 text-white" },
  f: { label: "die", color: "bg-rose-500 text-white" },
  n: { label: "das", color: "bg-emerald-500 text-white" },
};

function formatDefinition(text: string): string[] {
  const parts = text.split(/\s*;\s*/).filter((p) => p.trim());
  return parts.length > 1 ? parts : [text];
}

/** Parse target_word to separate IPA, POS, and clean translation */
function parseTargetWord(text: string, category?: string | null, tags?: string | null) {
  let remaining = text;
  let ipa: string | null = null;

  // Extract IPA: / ... / (with unicode phonetic chars)
  const ipaMatch = remaining.match(/\/\s*[^/]+\s*\//);
  if (ipaMatch) {
    ipa = ipaMatch[0].trim();
    remaining = remaining.replace(ipaMatch[0], "");
  }

  // Clean up leading separators
  remaining = remaining.replace(/^[;\s]+/, "").trim();

  // Strip gender artifacts from Kaikki data (e.g. ", female", ", masculine")
  remaining = remaining.replace(/^,?\s*(female|male|masculine|feminine|neuter)\s*/i, "").trim();

  // Extract POS if at start and not already in category
  let pos: string | null = null;
  const posMatch = remaining.match(
    /^(verb|noun|adjective|adverb|preposition|conjunction|pronoun|interjection|article|determiner|particle|name|adjectif|nom|verbe)\s*/i,
  );
  if (posMatch) {
    pos = posMatch[1].toLowerCase();
    remaining = remaining.slice(posMatch[0].length).trim();
  }

  // Use category as POS fallback
  if (!pos && category && category !== "dictionary" && category !== "sentence") {
    pos = category;
  }

  // Use tags as IPA fallback (Kaikki stores IPA in tags)
  if (!ipa && tags && /\/.*\//.test(tags)) {
    ipa = tags;
  }

  return { clean: remaining, ipa, pos };
}

export default function Dictionary() {
  const { t } = useTranslation();
  const { languagePairs, reloadSettings } = useApp();
  const { activePair } = useFeaturePair("dictionary");
  const isAiConfigured = useAppStore(selectIsAiConfigured);

  const cachedState = useAppStore.getState().dictionaryCache;

  const [words, setWords] = useState<Word[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [searchQuery, setSearchQuery] = useState(cachedState?.searchQuery ?? "");
  const deferredQuery = useDeferredValue(searchQuery);

  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

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

  // Track whether metadata (decks/favorites) has been loaded for current pair
  const [metaLoaded, setMetaLoaded] = useState(false);

  // Load metadata (decks, favorites, count) once per pair change
  useEffect(() => {
    const cache = useAppStore.getState().dictionaryCache;
    if (!cache) {
      setSelectedWord(null);
      setAiContent(null);
      setFavoriteIds(new Set());
      setSearchQuery("");
    }

    if (!activePair) {
      setLoading(false);
      return;
    }

    setMetaLoaded(false);
    Promise.all([
      bridge.getWordCount(activePair.id),
      bridge.getDecks(activePair.id),
      bridge.getFavorites(activePair.id),
    ])
      .then(([count, d, favs]) => {
        setTotalCount(count);
        setDecks(d);
        setFavoriteIds(new Set((favs as FavoriteWord[]).map((f) => f.word_id)));
        setMetaLoaded(true);
      })
      .catch((err) => console.error("Failed to load dictionary metadata:", err));
  }, [activePair]);

  // Load words: either paginated browse or server-side search
  useEffect(() => {
    if (!activePair || !metaLoaded) return;

    const query = deferredQuery.trim();
    let cancelled = false;

    setLoading(true);

    const reversePairId = selectReversePairId(useAppStore.getState()) ?? undefined;
    const promise = query
      ? bridge.searchWords(activePair.id, query, undefined, undefined, reversePairId)
      : bridge.getWords(activePair.id, undefined, PAGE_SIZE, 0);

    promise
      .then((w) => {
        if (cancelled) return;
        setWords(w);
        setHasMore(!query && w.length >= PAGE_SIZE);

        // Restore selected word from cache on first load
        const cache = useAppStore.getState().dictionaryCache;
        if (cache?.selectedWordId != null) {
          const restored = w.find((word: Word) => word.id === cache.selectedWordId);
          if (restored) setSelectedWord(restored);
        }
      })
      .catch((err) => { if (!cancelled) console.error("Failed to load words:", err); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [activePair, deferredQuery, metaLoaded]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (!activePair || loadingMore || !hasMore || deferredQuery.trim()) return;
    setLoadingMore(true);
    try {
      const more = await bridge.getWords(activePair.id, undefined, PAGE_SIZE, words.length);
      if (more.length < PAGE_SIZE) setHasMore(false);
      setWords((prev) => [...prev, ...more]);
    } catch (err) {
      console.error("Failed to load more:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [activePair, loadingMore, hasMore, words.length, deferredQuery]);

  const toggleFavorite = useCallback((wordId: number) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  }, []);

  const handleAskAi = useCallback(async (word: Word) => {
    if (!activePair) return;
    setAiLoading(true);
    setAiContent(null);
    try {
      const sourceLang = activePair.source_name;
      const targetLang = activePair.target_name;
      const prompt = `You are a language learning assistant. Give detailed information about this word.

Word: "${word.source_word}" (${sourceLang})
${word.target_word ? `Known translation: ${word.target_word}` : ""}
${word.gender ? `Gender: ${word.gender}` : ""}
${word.category ? `Category: ${word.category}` : ""}

Please provide in ${targetLang}:
1. **Translation** — precise translation(s) in ${targetLang}
2. **Grammar** — gender, plural form, part of speech, declension/conjugation notes
3. **Example sentences** — 3 example sentences with ${targetLang} translation
4. **Usage notes** — common expressions, collocations, register
5. **Related words** — synonyms, antonyms, word family

Format with markdown. Be concise but thorough. Answer in ${targetLang}.`;

      const result = await bridge.askAi(prompt);
      setAiContent(result);
    } catch (err) {
      setAiContent(`Erreur: ${err}`);
    } finally {
      setAiLoading(false);
    }
  }, [activePair]);

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

  const speak = useCallback((text: string, lang?: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    speechSynthesis.speak(utterance);
  }, []);

  if (loading && words.length === 0) {
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
      <PageHeader title={t("dictionary.title")} subtitle={t("dictionary.wordsAvailable", { count: totalCount })} />

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
          {t("dictionary.resultsFor", { count: words.length, query: deferredQuery })}
        </p>
      )}

      {/* Word list */}
      {words.length === 0 && !loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 space-y-6">
          <p className="text-lg font-medium">{t("dictionary.noWordsFound")}</p>
          <ExamplePreview onClick={() => setSearchQuery(FLASHCARD_EXAMPLE.front)}>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex items-center gap-3 text-left">
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">die</span>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-900 dark:text-white text-sm">{FLASHCARD_EXAMPLE.front}</span>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{FLASHCARD_EXAMPLE.back}</p>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0">A1</span>
            </div>
          </ExamplePreview>
        </div>
      ) : (
        <div className="space-y-2">
          {words.map((word) => {
            const gender = word.gender ? genderBadges[word.gender] : null;
            const isSelected = selectedWord?.id === word.id;
            const parsed = parseTargetWord(word.target_word, word.category, word.tags);

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
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">
                      {word.source_word}
                    </span>
                    {parsed.clean && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                        {parsed.clean}
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
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
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
                        </div>
                        {/* Translation / definition */}
                        {parsed.clean && (
                          <div className="mt-2 space-y-1">
                            {formatDefinition(parsed.clean).map((def, i) => (
                              <p key={i} className="text-sm text-gray-600 dark:text-gray-300">
                                {formatDefinition(parsed.clean).length > 1 && (
                                  <span className="text-gray-400 mr-1">{i + 1}.</span>
                                )}
                                {def}
                              </p>
                            ))}
                          </div>
                        )}
                        {word.plural && (
                          <p className="text-xs text-gray-400 mt-1">Pluriel : {word.plural}</p>
                        )}
                        {word.example_source && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">
                            &laquo; {word.example_source} &raquo;
                            {word.example_target && (
                              <span className="not-italic text-gray-400 dark:text-gray-500 ml-2">
                                — {word.example_target}
                              </span>
                            )}
                          </p>
                        )}
                        {/* IPA phonetics */}
                        {parsed.ipa && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-mono">
                            {parsed.ipa}
                          </p>
                        )}
                      </div>
                      <button onClick={closeWordDetail} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X size={18} />
                      </button>
                    </div>

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
                      <FavoriteButton
                        wordId={word.id}
                        isFavorite={favoriteIds.has(word.id)}
                        onToggle={() => toggleFavorite(word.id)}
                      />
                      <DeckPopover
                        wordId={word.id}
                        pairId={activePair!.id}
                        decks={decks}
                        onDecksChanged={() => bridge.getDecks(activePair!.id).then(setDecks).catch(console.error)}
                      />
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

          {/* Load more */}
          {hasMore && !deferredQuery.trim() && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 size={16} className="inline animate-spin" />
              ) : (
                `${t("dictionary.loadMore")} — ${words.length}/${totalCount}`
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
