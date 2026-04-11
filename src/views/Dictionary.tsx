import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Loader2,
  Sparkles,
  Volume2,
  AlertTriangle,
  Search,
  Settings as SettingsIcon,
  ChevronLeft,
  Save,
  CheckCircle,
  Trash2,
  BookOpen,
} from "lucide-react";
import PageHeader from "../components/ui/PageHeader";
import Spinner from "../components/ui/Spinner";

import { useApp } from "../store/AppContext";
import { useAppStore, selectIsAiConfigured } from "../store/useAppStore";
import { useFeaturePair } from "../lib/useFeaturePair";
import ExamplePreview from "../components/ui/ExamplePreview";
import RecentSearches from "../components/ui/RecentSearches";
import { DICTIONARY_EXAMPLE } from "../lib/exampleData";
import { useExampleTranslations } from "../lib/useExampleTranslations";

import { formatMessage } from "../lib/markdown";
import { cachedAskAi, addToHistory } from "../lib/ai-cache";
import * as bridge from "../lib/bridge";
import type { DictionaryEntry } from "../types";

// Module-level cache to avoid reloading saved entries on every tab switch.
let _entriesCache: { pairId: number; entries: DictionaryEntry[] } | null = null;

export default function Dictionary() {
  const { t } = useTranslation();
  const { languagePairs } = useApp();
  const { activePair } = useFeaturePair("dictionary");
  const isAiConfigured = useAppStore(selectIsAiConfigured);

  const cachedState = useAppStore.getState().dictionaryCache;

  // ── State ─────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const [searchQuery, setSearchQuery] = useState(cachedState?.searchQuery ?? "");
  const [showHistory, setShowHistory] = useState(false);

  // Currently displayed entry: either a saved one (selected) OR a fresh AI
  // lookup that hasn't been saved yet (aiQuery + aiContent).
  const [selected, setSelected] = useState<DictionaryEntry | null>(null);
  const [aiQuery, setAiQuery] = useState<string | null>(cachedState?.aiQuery ?? null);
  const [aiContent, setAiContent] = useState<string | null>(cachedState?.aiContent ?? null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Save / delete UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Example preview translation — shown on the empty list state.
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

  // ── Load saved entries on pair change ────────────────────────────
  useEffect(() => {
    if (!activePair) {
      setEntries([]);
      setLoadingEntries(false);
      return;
    }

    // Use module-level cache if pair hasn't changed
    if (_entriesCache && _entriesCache.pairId === activePair.id) {
      setEntries(_entriesCache.entries);
      setLoadingEntries(false);
      // Restore selected from zustand cache, if any
      const c = useAppStore.getState().dictionaryCache;
      if (c?.selectedId != null) {
        const restored = _entriesCache.entries.find((e) => e.id === c.selectedId);
        if (restored) setSelected(restored);
      }
      return;
    }

    setLoadingEntries(true);
    bridge
      .getDictionaryEntries(activePair.id)
      .then((loaded) => {
        _entriesCache = { pairId: activePair.id, entries: loaded };
        setEntries(loaded);
        const c = useAppStore.getState().dictionaryCache;
        if (c?.selectedId != null) {
          const restored = loaded.find((e) => e.id === c.selectedId);
          if (restored) setSelected(restored);
        }
      })
      .catch((err) => console.error("Failed to load dictionary entries:", err))
      .finally(() => setLoadingEntries(false));
  }, [activePair]);

  // Sync view state to Zustand cache
  useEffect(() => {
    useAppStore.getState().setDictionaryCache({
      searchQuery,
      selectedId: selected?.id ?? null,
      aiQuery,
      aiContent,
    });
  }, [searchQuery, selected, aiQuery, aiContent]);

  const refreshEntries = useCallback(async () => {
    if (!activePair) return;
    try {
      const loaded = await bridge.getDictionaryEntries(activePair.id);
      _entriesCache = { pairId: activePair.id, entries: loaded };
      setEntries(loaded);
    } catch (err) {
      console.error("Failed to refresh dictionary entries:", err);
    }
  }, [activePair]);

  // ── AI prompt builder ─────────────────────────────────────────────
  // Improved prompt: detects input language, requests IPA + part of speech,
  // structured sections, omits empty ones, every learning-language token
  // paired with a native-language gloss.
  const buildAiPrompt = useCallback((query: string) => {
    if (!activePair) return "";
    const nativeLang = activePair.source_name;
    const learningLang = activePair.target_name;

    return `You are a bilingual dictionary assistant inside a language-learning app.
The user is a native ${nativeLang} speaker who is learning ${learningLang}.
They looked up: "${query}"

Step 1 — detect from spelling and morphology whether "${query}" is ${nativeLang} or ${learningLang}.
Step 2 — write a complete dictionary entry FOR them in ${nativeLang}.

Output STRICT markdown — no preamble, no closing remarks, no code fences.
ALL section headings MUST be in ${nativeLang} (translate the headings yourself).

## ${nativeLang} heading: "Headword"
**${query}** /<IPA pronunciation>/ — *<part of speech in ${nativeLang}>*${""}
On a second line: gender, plural, conjugation class, separable particle or any morphological note that matters.

## ${nativeLang} heading: "Translation"
1-3 short translations in the OTHER language, comma-separated on a single line.
If the headword has multiple distinct meanings, number them: \`1. … 2. … 3. …\`

## ${nativeLang} heading: "Definition"
1-2 sentences in ${nativeLang} per meaning. Use **bold** for the most important nuance words.

## ${nativeLang} heading: "Examples"
Exactly 3 short, natural example sentences. Format EACH example as TWO lines:
> **<sentence in ${learningLang}>**
> *<translation in ${nativeLang}>*

Leave a blank line between examples. Pick sentences that show typical usage, not contrived ones.

## ${nativeLang} heading: "Usage notes"
2-4 bullets in ${nativeLang}: register (formal/informal/slang), common collocations, regional differences, false friends, things a learner typically gets wrong.

## ${nativeLang} heading: "Synonyms"
3-5 ${learningLang} synonyms, each followed by its ${nativeLang} gloss in parentheses, comma-separated on one line. Omit this section entirely if no meaningful synonyms exist.

## ${nativeLang} heading: "Antonyms"
2-3 ${learningLang} antonyms with ${nativeLang} glosses. Omit this section entirely if no antonyms apply.

Rules:
- Be precise and concise. No filler.
- Every section heading MUST be in ${nativeLang}.
- Every ${learningLang} word, phrase or sentence MUST be paired with a ${nativeLang} translation.
- Never write "N/A", "none", or empty placeholders — just omit the section.
- Never wrap the response in code fences.`;
  }, [activePair]);

  // ── Lookup handler ────────────────────────────────────────────────
  const handleLookup = useCallback(async (rawQuery?: string) => {
    const query = (rawQuery ?? searchQuery).trim();
    if (!query || !activePair || aiLoading) return;

    // Step 1: if the user already saved this exact query, jump straight to it.
    const existing = entries.find((e) => e.query.toLowerCase() === query.toLowerCase());
    if (existing) {
      setSelected(existing);
      setAiQuery(null);
      setAiContent(null);
      setSaved(false);
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiContent(null);
    setSelected(null);
    setAiQuery(query);
    setSaved(false);
    try {
      addToHistory(activePair.id, "dictionary", query);
      const result = await cachedAskAi("dictionary", query, activePair.id, buildAiPrompt(query));
      setAiContent(result);
    } catch (err) {
      setAiError(String(err));
    } finally {
      setAiLoading(false);
    }
  }, [searchQuery, activePair, aiLoading, entries, buildAiPrompt]);

  // ── Save AI lookup to DB ──────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!activePair || !aiQuery || !aiContent || saving) return;
    setSaving(true);
    try {
      const newId = await bridge.saveDictionaryEntry(activePair.id, aiQuery, aiContent);
      // Refresh list and transition to "viewing saved entry" mode
      await refreshEntries();
      const reloaded = await bridge.getDictionaryEntries(activePair.id);
      const justSaved = reloaded.find((e) => e.id === newId);
      if (justSaved) {
        setSelected(justSaved);
        setAiQuery(null);
        setAiContent(null);
      }
      setSaved(true);
    } catch (err) {
      setAiError(String(err));
    } finally {
      setSaving(false);
    }
  }, [activePair, aiQuery, aiContent, saving, refreshEntries]);

  // ── Delete saved entry ────────────────────────────────────────────
  const handleDelete = useCallback(async (entryId: number) => {
    if (!activePair) return;
    try {
      await bridge.deleteDictionaryEntry(entryId, activePair.id);
      _entriesCache = null;
      await refreshEntries();
      // If the deleted entry was the one being viewed, go back to the list
      if (selected?.id === entryId) {
        setSelected(null);
        setAiQuery(null);
        setAiContent(null);
      }
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  }, [activePair, selected, refreshEntries]);

  // ── Back to list ──────────────────────────────────────────────────
  const goBackToList = useCallback(() => {
    setSelected(null);
    setAiQuery(null);
    setAiContent(null);
    setAiError(null);
    setSaved(false);
    setSearchQuery("");
  }, []);

  // ── Pronunciation playback ────────────────────────────────────────
  const speak = useCallback((text: string, lang?: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    speechSynthesis.speak(utterance);
  }, []);

  // Restore handler scroll-to-top when transitioning views
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected || aiContent) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selected, aiContent]);

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────

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

  if (loadingEntries) {
    return <Spinner fullPage />;
  }

  // ─────────────────────────────────────────────────────────────────
  // Detail view — viewing a saved entry OR a fresh AI lookup
  // ─────────────────────────────────────────────────────────────────
  const isViewingDetail = selected != null || aiContent != null || aiLoading;
  if (isViewingDetail) {
    const headword = selected?.query ?? aiQuery ?? "";
    const content = selected?.content ?? aiContent;
    const isUnsaved = aiContent != null && selected == null;

    return (
      <div className="space-y-6" ref={detailRef}>
        {/* Header with headword + speaker icon */}
        <div className="mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{headword}</h1>
            <button
              onClick={() => speak(headword, activePair?.target_lang)}
              className="p-1 rounded-full text-gray-400 hover:text-amber-500 transition-colors"
              title="Pronounce"
            >
              <Volume2 size={18} />
            </button>
          </div>
          {selected && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {new Date(selected.created_at).toLocaleString()}
            </p>
          )}
        </div>

        {/* AI loading spinner */}
        {aiLoading && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              {t("common.loading")}
            </div>
          </div>
        )}

        {/* AI error */}
        {aiError && !aiLoading && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-400">{aiError}</p>
          </div>
        )}

        {/* AI content card */}
        {content && !aiLoading && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <div
              className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 max-w-none
                         [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2:dark]:text-white
                         [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:first:mt-0
                         [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1
                         [&_blockquote]:my-2 [&_blockquote]:pl-4 [&_blockquote]:border-l-2
                         [&_blockquote]:border-amber-300 [&_blockquote:dark]:border-amber-600
                         [&_blockquote]:text-gray-700 [&_blockquote:dark]:text-gray-200
                         [&_strong]:font-semibold [&_strong]:text-gray-900 [&_strong:dark]:text-white"
              dangerouslySetInnerHTML={{ __html: formatMessage(content) }}
            />
          </div>
        )}

        {/* Action buttons (mirrors Grammar) */}
        <div className="flex flex-wrap gap-3">
          {/* Back */}
          <button
            onClick={goBackToList}
            className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-amber-400 dark:hover:border-amber-500 rounded-xl text-sm font-semibold transition-colors"
          >
            <ChevronLeft size={16} />
            {t("common.back")}
          </button>

          {/* Save (only when viewing a fresh AI lookup that isn't yet saved) */}
          {isUnsaved && !saved && content && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {t("common.save")}
            </button>
          )}
          {saved && (
            <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-semibold">
              <CheckCircle size={16} />
              {t("common.save")}
            </span>
          )}

          {/* Delete (only for saved entries) */}
          {selected && !isUnsaved && (
            confirmDeleteId === selected.id ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {t("common.confirm")}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-sm font-semibold transition-colors"
                >
                  {t("common.cancel")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(selected.id)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-red-500 rounded-xl text-sm font-semibold transition-colors"
                title={t("dictionary.deleteEntryConfirm")}
              >
                <Trash2 size={16} />
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // List view — search input + saved entries
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader title={t("dictionary.title")} subtitle={t("dictionary.lookupHint")} />

      {/* Search bar with submit button */}
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

      {/* Saved entries list (if any) */}
      {entries.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {t("dictionary.savedEntries")}
          </h2>
          <div className="space-y-2">
            {entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => {
                  setSelected(entry);
                  setAiQuery(null);
                  setAiContent(null);
                  setSaved(false);
                }}
                className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-all flex items-center gap-3"
              >
                <BookOpen size={16} className="text-amber-500 flex-shrink-0" />
                <span className="font-semibold text-gray-900 dark:text-white text-sm flex-1">
                  {entry.query}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(entry.created_at).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        // Empty state preview when there are no saved entries yet.
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
    </div>
  );
}
