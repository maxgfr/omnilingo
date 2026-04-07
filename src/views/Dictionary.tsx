import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";
import {
  Search,
  Plus,
  Filter,
  BookOpen,
  Check,
  ChevronDown,
  Loader2,
  Heart,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { useFeaturePair } from "../lib/useFeaturePair";
import LanguagePairBar from "../components/LanguagePairBar";
import * as bridge from "../lib/bridge";
import type { Word } from "../types";

const LEVELS = ["A1", "A2", "B1", "B2"];
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

export default function Dictionary() {
  const { t } = useTranslation();
  const { languagePairs } = useApp();
  const { activePair, switchPair } = useFeaturePair("dictionary");

  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Favorites
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // SRS tracking
  const [addedToSrs, setAddedToSrs] = useState<Set<number>>(new Set());
  const [addingToSrs, setAddingToSrs] = useState<Set<number>>(new Set());

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
  useEffect(() => {
    if (!activePair) {
      setLoading(false);
      return;
    }
    setLoading(true);

    Promise.all([
      bridge.getWords(activePair.id, undefined, PAGE_SIZE, 0),
      bridge.getCategories(activePair.id),
      bridge.getWordCount(activePair.id),
      bridge.getFavorites(activePair.id),
    ])
      .then(([w, c, count, favs]) => {
        setWords(w);
        setCategories(c);
        setTotalCount(count);
        setOffset(PAGE_SIZE);
        setHasMore(w.length >= PAGE_SIZE);
        setFavoriteIds(new Set(favs.map((f: { word_id: number }) => f.word_id)));
      })
      .catch((err) => console.error("Failed to load dictionary:", err))
      .finally(() => setLoading(false));
  }, [activePair]);

  // Debounced search
  const performSearch = useCallback(
    (query: string, level: string | null, category: string | null) => {
      if (!activePair) return;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setLoading(true);
        if (query.trim()) {
          bridge
            .searchWords(
              activePair.id,
              query.trim(),
              level ?? undefined,
              category ?? undefined,
            )
            .then((results) => {
              setWords(results);
              setHasMore(false);
              setOffset(0);
            })
            .finally(() => setLoading(false));
        } else {
          bridge
            .getWords(activePair.id, level ?? undefined, PAGE_SIZE, 0)
            .then((results) => {
              setWords(results);
              setOffset(PAGE_SIZE);
              setHasMore(results.length >= PAGE_SIZE);
            })
            .finally(() => setLoading(false));
        }
      }, 300);
    },
    [activePair],
  );

  // Trigger search on filter changes
  useEffect(() => {
    performSearch(searchQuery, filterLevel, filterCategory);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, filterLevel, filterCategory, performSearch]);

  // Load more
  function loadMore() {
    if (!activePair || loadingMore || !hasMore || searchQuery.trim()) return;
    setLoadingMore(true);
    bridge
      .getWords(activePair.id, filterLevel ?? undefined, PAGE_SIZE, offset)
      .then((moreWords) => {
        setWords((prev) => [...prev, ...moreWords]);
        setOffset((prev) => prev + PAGE_SIZE);
        setHasMore(moreWords.length >= PAGE_SIZE);
      })
      .finally(() => setLoadingMore(false));
  }

  // Add to SRS
  async function handleAddToSrs(wordId: number) {
    if (addedToSrs.has(wordId) || addingToSrs.has(wordId)) return;
    setAddingToSrs((prev) => new Set(prev).add(wordId));
    try {
      await bridge.addWordToSrs(wordId);
      setAddedToSrs((prev) => new Set(prev).add(wordId));
    } catch {
      // Word may already be in SRS
      setAddedToSrs((prev) => new Set(prev).add(wordId));
    } finally {
      setAddingToSrs((prev) => {
        const next = new Set(prev);
        next.delete(wordId);
        return next;
      });
    }
  }

  // Toggle level filter
  function toggleLevel(level: string) {
    setFilterLevel((prev) => (prev === level ? null : level));
  }

  // Fuzzy reranking of search results
  const rerankedWords = useMemo(() => {
    if (!searchQuery.trim() || words.length === 0) return words;
    const fuse = new Fuse(words, { keys: ["source_word", "target_word"], threshold: 0.4 });
    return fuse.search(searchQuery.trim()).map((r) => r.item);
  }, [words, searchQuery]);

  // Filtered words for favorites
  const displayWords = showFavoritesOnly
    ? (searchQuery.trim() ? rerankedWords : words).filter(w => favoriteIds.has(w.id))
    : searchQuery.trim() ? rerankedWords : words;

  // Save custom word
  if (loading && words.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LanguagePairBar pairs={languagePairs} activePairId={activePair?.id ?? null} onSwitch={switchPair} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("dictionary.title")}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("dictionary.wordsAvailable", { count: totalCount })}
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("dictionary.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-gray-400"
          />
        </div>
        <button
          onClick={() => setShowFavoritesOnly(prev => !prev)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            showFavoritesOnly
              ? "bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
          title={t("dictionary.favoritesOnly")}
        >
          <Heart size={16} fill={showFavoritesOnly ? "currentColor" : "none"} />
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            showFilters || filterLevel || filterCategory
              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          <Filter size={16} />
          {t("dictionary.filters")}
          {(filterLevel || filterCategory) && (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
          {/* Level filter */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
              {t("common.level")}
            </label>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    filterLevel === level
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {level}
                </button>
              ))}
              {filterLevel && (
                <button
                  onClick={() => setFilterLevel(null)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {t("common.clear")}
                </button>
              )}
            </div>
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                Category
              </label>
              <div className="relative">
                <select
                  value={filterCategory || ""}
                  onChange={(e) =>
                    setFilterCategory(e.target.value || null)
                  }
                  className="w-full appearance-none px-3 py-2 pr-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
                >
                  <option value="">{t("dictionary.allCategories")}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      {searchQuery.trim() && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("dictionary.resultsFor", { count: words.length, query: searchQuery })}
        </p>
      )}

      {/* Word list */}
      {displayWords.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 space-y-4">
          <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">{t("dictionary.noWordsFound")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayWords.map((word) => {
            const gender = word.gender ? genderBadges[word.gender] : null;
            const isAdded = addedToSrs.has(word.id);
            const isAdding = addingToSrs.has(word.id);

            return (
              <div
                key={word.id}
                className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex items-center gap-3 transition-all hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600"
              >
                {/* Gender badge */}
                {activePair?.source_lang === "de" && gender && (
                  <span
                    className={`${gender.color} text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 uppercase`}
                  >
                    {gender.label}
                  </span>
                )}

                {/* Source word */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                      {word.source_word}
                    </span>
                    {word.plural && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                        pl. {word.plural}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {word.target_word}
                  </p>
                </div>

                {/* Level tag */}
                {word.level && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${levelColors[word.level] || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}
                  >
                    {word.level}
                  </span>
                )}

                {/* Category */}
                {word.category && (
                  <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {word.category}
                  </span>
                )}

                {/* Favorite button */}
                <button
                  onClick={async () => {
                    const isFav = await bridge.toggleFavorite(word.id);
                    setFavoriteIds(prev => {
                      const next = new Set(prev);
                      isFav ? next.add(word.id) : next.delete(word.id);
                      return next;
                    });
                  }}
                  className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
                    favoriteIds.has(word.id)
                      ? "text-rose-500 hover:text-rose-600"
                      : "text-gray-300 dark:text-gray-600 hover:text-rose-400"
                  }`}
                  title={t("favorites.title")}
                >
                  <Heart size={16} fill={favoriteIds.has(word.id) ? "currentColor" : "none"} />
                </button>

                {/* Add to SRS button */}
                <button
                  onClick={() => handleAddToSrs(word.id)}
                  disabled={isAdded || isAdding}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
                    isAdded
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 cursor-default"
                      : isAdding
                        ? "bg-gray-100 dark:bg-gray-700 text-gray-400 border border-gray-200 dark:border-gray-700 cursor-wait"
                        : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400"
                  }`}
                  title={isAdded ? t("dictionary.alreadyAdded") : t("dictionary.addToSrs")}
                >
                  {isAdded ? (
                    <>
                      <Check size={14} />
                      <span className="hidden sm:inline">{t("common.added")}</span>
                    </>
                  ) : isAdding ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={14} />
                      <span className="hidden sm:inline">SRS</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && !searchQuery.trim() && !showFavoritesOnly && words.length > 0 && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:border-amber-400 dark:hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-all disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                {t("dictionary.loadMore")}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
