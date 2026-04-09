import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Sparkles,
  Volume2,
  AlertTriangle,
  Loader2,
  Heart,
  Search,
  Plus,
  Trash2,
  PenLine,
} from "lucide-react";
import Spinner from "../components/ui/Spinner";
import PageHeader from "../components/ui/PageHeader";
import { useAppStore, selectIsAiConfigured } from "../store/useAppStore";
import { useFeaturePair } from "../lib/useFeaturePair";
import FavoriteButton from "../components/FavoriteButton";
import { levelColors, genderBadges, parseTargetWord, formatDefinition } from "../lib/wordUtils";
import { formatMessage } from "../lib/markdown";
import * as bridge from "../lib/bridge";
import type { FavoriteWord, FavoriteList } from "../types";

// Module-level cache to avoid reloading on tab switch
let _favCache: { pairId: number; favorites: FavoriteWord[]; lists: FavoriteList[] } | null = null;

export default function Favorites() {
  const { t } = useTranslation();
  const { activePair } = useFeaturePair("favorites");
  const isAiConfigured = useAppStore(selectIsAiConfigured);

  // Restore cached state
  const cachedState = useAppStore.getState().favoritesCache;

  const [favorites, setFavorites] = useState<FavoriteWord[]>([]);
  const [favoriteLists, setFavoriteLists] = useState<FavoriteList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(cachedState?.searchQuery ?? "");

  // List selection: null = "All", number = specific list
  const [activeListId, setActiveListId] = useState<number | null>(cachedState?.activeListId ?? null);
  const [listItems, setListItems] = useState<FavoriteWord[]>([]);

  const [selectedWordId, setSelectedWordId] = useState<number | null>(cachedState?.selectedWordId ?? null);
  const [aiContent, setAiContent] = useState<string | null>(cachedState?.aiContent ?? null);
  const [aiLoading, setAiLoading] = useState(false);

  // New list creation
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  // Delete confirmation
  const [deletingListId, setDeletingListId] = useState<number | null>(null);

  // Rename list
  const [renamingListId, setRenamingListId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");


  // Sync view state to Zustand cache
  useEffect(() => {
    useAppStore.getState().setFavoritesCache({
      searchQuery,
      selectedWordId,
      activeListId,
      aiContent,
    });
  }, [searchQuery, selectedWordId, activeListId, aiContent]);

  // Load data on pair change
  useEffect(() => {
    const cache = useAppStore.getState().favoritesCache;
    if (!cache) {
      setSelectedWordId(null);
      setAiContent(null);
      setSearchQuery("");
      setActiveListId(null);
    }

    if (!activePair) {
      setLoading(false);
      return;
    }

    // Use module-level cache if pair hasn't changed
    if (_favCache && _favCache.pairId === activePair.id) {
      setFavorites(_favCache.favorites);
      setFavoriteLists(_favCache.lists);
      if (cache?.activeListId != null && !_favCache.lists.some((l) => l.id === cache.activeListId)) {
        setActiveListId(null);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      bridge.getFavorites(activePair.id),
      bridge.getFavoriteLists(activePair.id),
    ])
      .then(([favs, lists]) => {
        _favCache = { pairId: activePair.id, favorites: favs, lists };
        setFavorites(favs);
        setFavoriteLists(lists);
        if (cache?.activeListId != null && !lists.some((l) => l.id === cache.activeListId)) {
          setActiveListId(null);
        }
      })
      .catch((err) => console.error("Failed to load favorites:", err))
      .finally(() => setLoading(false));
  }, [activePair]);

  // Load list items when a specific list is selected
  useEffect(() => {
    if (activeListId == null) {
      setListItems([]);
      return;
    }
    bridge.getFavoriteListItems(activeListId)
      .then(setListItems)
      .catch((err) => console.error("Failed to load list items:", err));
  }, [activeListId, favoriteLists]);

  const reloadLists = useCallback(async () => {
    if (!activePair) return;
    const lists = await bridge.getFavoriteLists(activePair.id);
    setFavoriteLists(lists);
    // Reload current list items if viewing a specific list
    if (activeListId != null) {
      const items = await bridge.getFavoriteListItems(activeListId);
      setListItems(items);
    }
  }, [activePair, activeListId]);


  const handleUnfavorite = useCallback((wordId: number) => {
    setFavorites((prev) => prev.filter((f) => f.word_id !== wordId));
    setListItems((prev) => prev.filter((f) => f.word_id !== wordId));
    if (selectedWordId === wordId) {
      setSelectedWordId(null);
      setAiContent(null);
    }
  }, [selectedWordId]);

  const handleAskAi = useCallback(async (fav: FavoriteWord) => {
    if (!activePair) return;
    setAiLoading(true);
    setAiContent(null);
    try {
      const sourceLang = activePair.source_name;
      const targetLang = activePair.target_name;
      const prompt = `You are a bilingual language learning assistant for ${sourceLang} and ${targetLang}.

Word: "${fav.source_word}" (${sourceLang})
${fav.target_word ? `Known translation: ${fav.target_word}` : ""}
${fav.gender ? `Gender: ${fav.gender}` : ""}
${fav.category ? `Category: ${fav.category}` : ""}

Provide a bilingual explanation covering BOTH ${sourceLang} and ${targetLang}:
1. **Translation** — precise translation(s) between ${sourceLang} ↔ ${targetLang}
2. **Grammar** — gender, plural form, part of speech, declension/conjugation notes (in both languages)
3. **Example sentences** — 3 examples, each with the sentence in ${sourceLang} AND its translation in ${targetLang}
4. **Usage notes** — common expressions, collocations, register (in both languages)
5. **Related words** — synonyms, antonyms, word family (in both languages)

Format with markdown. Be concise but thorough. Write section titles and explanations in ${targetLang}, but always include both ${sourceLang} and ${targetLang} for vocabulary, examples and expressions.`;

      const result = await bridge.askAi(prompt);
      setAiContent(result);
    } catch (err) {
      setAiContent(`Erreur: ${err}`);
    } finally {
      setAiLoading(false);
    }
  }, [activePair]);

  const speak = useCallback((text: string, lang?: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    speechSynthesis.speak(utterance);
  }, []);

  const handleCreateList = useCallback(async () => {
    if (!newListName.trim() || creatingList || !activePair) return;
    setCreatingList(true);
    try {
      await bridge.createFavoriteList(newListName.trim(), activePair.id);
      setNewListName("");
      setShowNewList(false);
      await reloadLists();
    } catch (err) {
      console.error("Failed to create list:", err);
    } finally {
      setCreatingList(false);
    }
  }, [newListName, creatingList, activePair, reloadLists]);

  const handleDeleteList = useCallback(async (listId: number) => {
    try {
      await bridge.deleteFavoriteList(listId);
      if (activeListId === listId) setActiveListId(null);
      setDeletingListId(null);
      await reloadLists();
    } catch (err) {
      console.error("Failed to delete list:", err);
    }
  }, [activeListId, reloadLists]);

  const handleRenameList = useCallback(async (listId: number) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingListId(null);
      return;
    }
    try {
      await bridge.renameFavoriteList(listId, trimmed);
      setRenamingListId(null);
      await reloadLists();
    } catch (err) {
      console.error("Failed to rename list:", err);
    }
  }, [renameValue, reloadLists]);

  if (loading) return <Spinner fullPage />;

  // Determine which items to display
  const displayItems = activeListId != null ? listItems : favorites;
  const filtered = searchQuery.trim()
    ? displayItems.filter((f) =>
        f.source_word.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.target_word.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : displayItems;

  const totalCount = activeListId != null
    ? listItems.length
    : favorites.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("favorites.title")}
        subtitle={totalCount > 0 ? `${totalCount} ${totalCount === 1 ? "mot" : "mots"}` : undefined}
      />

      {favorites.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 space-y-4">
          <Heart size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-medium">{t("favorites.empty")}</p>
        </div>
      ) : (
        <>
          {/* List tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setActiveListId(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeListId == null
                  ? "bg-amber-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {t("favorites.allFavorites")}
            </button>
            {favoriteLists.map((list) => (
              <div key={list.id} className="relative group">
                {renamingListId === list.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameList(list.id);
                      if (e.key === "Escape") setRenamingListId(null);
                    }}
                    onBlur={() => handleRenameList(list.id)}
                    autoFocus
                    className="px-2 py-1 text-sm rounded-lg border border-amber-400 dark:border-amber-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40 w-32"
                  />
                ) : (
                  <button
                    onClick={() => setActiveListId(list.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeListId === list.id
                        ? "bg-amber-500 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {list.name}
                    <span className="ml-1 opacity-60 text-xs">{list.item_count}</span>
                  </button>
                )}
                {activeListId === list.id && renamingListId !== list.id && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRenamingListId(list.id); setRenameValue(list.name); }}
                      className="absolute -top-1 -right-5 p-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-amber-100 hover:text-amber-500 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 transition-colors"
                    >
                      <PenLine size={10} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingListId(list.id); }}
                      className="absolute -top-1 -right-1 p-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </>
                )}
              </div>
            ))}
            {showNewList ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                  placeholder={t("favorites.listName")}
                  autoFocus
                  className="px-2 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40 placeholder:text-gray-400 w-32"
                />
                <button
                  onClick={handleCreateList}
                  disabled={!newListName.trim() || creatingList}
                  className="p-1.5 rounded-lg bg-amber-500 text-white disabled:opacity-50 hover:bg-amber-600 transition-colors"
                >
                  {creatingList ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                </button>
                <button
                  onClick={() => { setShowNewList(false); setNewListName(""); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewList(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          {/* Delete confirmation */}
          {deletingListId != null && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400 flex-1">{t("favorites.confirmDeleteList")}</p>
              <button
                onClick={() => handleDeleteList(deletingListId)}
                className="px-3 py-1 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                <Trash2 size={14} className="inline mr-1" />
                {t("common.delete")}
              </button>
              <button
                onClick={() => setDeletingListId(null)}
                className="px-3 py-1 rounded-lg text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {t("common.cancel")}
              </button>
            </div>
          )}

          {/* Search */}
          {displayItems.length > 5 && (
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
          )}

          {/* Empty list state */}
          {activeListId != null && displayItems.length === 0 && (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500">
              <p className="text-sm">{t("favorites.emptyList")}</p>
            </div>
          )}

          {/* Word list */}
          <div className="space-y-2">
            {filtered.map((fav) => {
              const gender = fav.gender ? genderBadges[fav.gender] : null;
              const isSelected = selectedWordId === fav.word_id;
              const parsed = parseTargetWord(fav.target_word, fav.category, fav.tags);

              return (
                <div key={fav.word_id}>
                  <button
                    onClick={() => {
                      if (isSelected) {
                        setSelectedWordId(null);
                        setAiContent(null);
                        setAiLoading(false);
                      } else {
                        setSelectedWordId(fav.word_id);
                        setAiContent(null);
                        setAiLoading(false);
                      }
                    }}
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
                          {fav.source_word}
                        </span>
                        {(parsed.translation || parsed.clean) && (
                          <span className="text-sm text-amber-600 dark:text-amber-400 truncate">
                            {parsed.translation || parsed.clean}
                          </span>
                        )}
                      </div>
                      {fav.example_source && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1 italic">
                          {fav.example_source}
                          {fav.example_target && <span className="not-italic ml-1">— {fav.example_target}</span>}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {parsed.pos && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 italic">
                          {parsed.pos}
                        </span>
                      )}
                      {fav.level && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${levelColors[fav.level] || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}>
                          {fav.level}
                        </span>
                      )}
                    </div>
                  </button>

                  {isSelected && (
                    <div className="rounded-b-xl border border-t-0 border-amber-400 dark:border-amber-600 bg-white dark:bg-gray-800 px-5 py-4 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            {fav.source_word}
                          </h3>
                          <button
                            onClick={(e) => { e.stopPropagation(); speak(fav.source_word, activePair?.source_lang); }}
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
                        <button
                          onClick={() => { setSelectedWordId(null); setAiContent(null); setAiLoading(false); }}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {/* Translation (short) */}
                      {parsed.translation && (
                        <div className="rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 p-3">
                          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1.5">
                            {t("dictionary.translation")}
                          </p>
                          <div className="space-y-1">
                            {formatDefinition(parsed.translation).map((def, i) => (
                              <p key={i} className="text-sm text-gray-700 dark:text-gray-200">
                                {formatDefinition(parsed.translation!).length > 1 && (
                                  <span className="text-amber-500 dark:text-amber-400 mr-1.5 font-medium">{i + 1}.</span>
                                )}
                                {def}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Definition (long descriptions) */}
                      {parsed.definition && (
                        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/30 p-3">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                            {t("dictionary.definition", "Définition")}
                          </p>
                          <div className="space-y-1">
                            {formatDefinition(parsed.definition).map((def, i) => (
                              <p key={i} className="text-sm text-gray-600 dark:text-gray-300">
                                {formatDefinition(parsed.definition!).length > 1 && (
                                  <span className="text-gray-400 dark:text-gray-500 mr-1.5 font-medium">{i + 1}.</span>
                                )}
                                {def}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fallback: show clean text if no split */}
                      {!parsed.translation && !parsed.definition && parsed.clean && (
                        <div className="rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 p-3">
                          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1.5">
                            {t("dictionary.translation")}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-200">{parsed.clean}</p>
                        </div>
                      )}

                      {/* Examples — separate section */}
                      {fav.example_source && (
                        <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-700/30 p-3">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                            {t("dictionary.examples")}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-200 italic">
                            &laquo; {fav.example_source} &raquo;
                          </p>
                          {fav.example_target && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              &laquo; {fav.example_target} &raquo;
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAskAi(fav); }}
                          disabled={aiLoading || !isAiConfigured}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          {aiLoading ? t("common.loading") : t("dictionary.exploreWithAi")}
                        </button>
                        <FavoriteButton
                          wordId={fav.word_id}
                          isFavorite={true}
                          onToggle={() => handleUnfavorite(fav.word_id)}
                          pairId={activePair?.id}
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
          </div>
        </>
      )}
    </div>
  );
}
