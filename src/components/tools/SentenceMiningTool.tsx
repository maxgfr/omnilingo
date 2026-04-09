import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2, Pickaxe,
  Trash2, AlertTriangle,
} from "lucide-react";
import * as bridge from "../../lib/bridge";
import { cachedAskAi, getCachedResult, addToHistory, getPromptContext, clearToolHistory } from "../../lib/ai-cache";
import type { LanguagePair } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import { parseAiJson, renderClickable } from "../../lib/markdown";
import ExamplePreview from "../ui/ExamplePreview";
import RecentSearches from "../ui/RecentSearches";
import FavoriteButton from "../FavoriteButton";

import { MINING_EXAMPLE, MINING_SAMPLE_INPUT } from "../../lib/exampleData";
import { levelColors } from "../../lib/wordUtils";

interface MinedSentence {
  sentence: string;
  translation: string;
  keyWords: { word: string; translation: string; level: string }[];
  grammar: string;
}


interface ToolProps {
  onWordClick?: (word: string) => void;
  activePair?: LanguagePair | null;
  initialWord?: string;
  onInputChange?: (value: string) => void;
}

function KeywordActions({
  word,
  resolveWordId,
  favoriteIds,
  toggleFavorite,
  pairId,
}: {
  word: string;
  resolveWordId: (w: string) => Promise<number | null>;
  favoriteIds: Set<number>;
  toggleFavorite: (id: number) => void;
  pairId?: number;
}) {
  const [wordId, setWordId] = useState<number | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    resolveWordId(word).then((id) => {
      if (!cancelled) {
        setWordId(id);
        setResolving(false);
      }
    });
    return () => { cancelled = true; };
  }, [word, resolveWordId]);

  if (resolving) {
    return <Loader2 size={12} className="ml-auto animate-spin text-gray-400 flex-shrink-0" />;
  }

  if (wordId == null) return null;

  return (
    <div className="ml-auto flex items-center gap-1 flex-shrink-0">
      <FavoriteButton
        wordId={wordId}
        isFavorite={favoriteIds.has(wordId)}
        onToggle={() => toggleFavorite(wordId)}
        pairId={pairId}
        className="!p-1"
      />
    </div>
  );
}

export default function SentenceMiningTool({ onWordClick, activePair, initialWord, onInputChange }: ToolProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState(initialWord || "");

  const handleInputChange = (value: string) => {
    setInput(value);
    onInputChange?.(value);
  };
  const cachedResult = useAppStore.getState().toolResultCache["mining"];
  const [result, setResult] = useState<MinedSentence[] | null>(() => {
    if (cachedResult) try { return JSON.parse(cachedResult); } catch { return null; }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (result) {
      useAppStore.getState().setToolResult("mining", JSON.stringify(result));
    }
  }, [result]);
  const [showHistory, setShowHistory] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [wordIdMap, setWordIdMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!activePair) return;
    bridge.getFavorites(activePair.id).then((favs) => {
      setFavoriteIds(new Set(favs.map((f) => f.word_id)));
    }).catch(console.error);
  }, [activePair]);

  // Restore cached result on mount
  useEffect(() => {
    if (initialWord && activePair) {
      const cached = getCachedResult("mining", initialWord, activePair.id);
      if (cached) {
        const parsed = parseAiJson<MinedSentence[]>(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setResult(parsed);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMine = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setWordIdMap(new Map());

    try {
      const level = "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);

      const prompt = `Extract useful sentences for language learning from this ${srcName} text.
Student level: ${level}. Learning ${srcName} from ${tgtName}.

For each sentence:
1. Select 3-8 sentences that are most useful for learning (natural, contain useful vocabulary/grammar)
2. Translate each to ${tgtName}
3. Identify key vocabulary words with translations and CEFR level
4. Note the grammar point demonstrated

Return ONLY valid JSON:
[
  {
    "sentence": "original sentence in ${srcName}",
    "translation": "translation in ${tgtName}",
    "keyWords": [{"word":"key word","translation":"translation","level":"A1|A2|B1|B2"}],
    "grammar": "grammar point this sentence demonstrates"
  }
]

${enriched}

Text to mine:
${input.trim()}`;

      addToHistory(activePair.id, "mining", input.trim().slice(0, 50));
      const response = await cachedAskAi("mining", input.trim(), activePair.id, prompt);
      const parsed = parseAiJson<MinedSentence[]>(response);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setResult(parsed);
      }
    } catch (err) {
      console.error(err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [input, loading, activePair]);


  const resolveWordId = useCallback(async (word: string): Promise<number | null> => {
    if (wordIdMap.has(word)) return wordIdMap.get(word)!;
    if (!activePair) return null;
    try {
      const words = await bridge.searchWords(activePair.id, word);
      if (words.length > 0) {
        setWordIdMap((prev) => new Map(prev).set(word, words[0].id));
        return words[0].id;
      }
    } catch { /* ignore */ }
    return null;
  }, [activePair, wordIdMap]);

  const toggleFavorite = useCallback((wordId: number) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  }, []);


  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => !input.trim() && setShowHistory(true)}
          onBlur={() => setTimeout(() => setShowHistory(false), 150)}
          placeholder={t("tools.mining.inputPlaceholder")}
          rows={6}
          autoComplete="off"
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 resize-y"
        />
        {activePair && <RecentSearches tool="mining" pairId={activePair.id} visible={showHistory && !input.trim()} onSelect={(q) => { handleInputChange(q); setShowHistory(false); }} />}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleMine}
          disabled={!input.trim() || loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Pickaxe size={16} />}
          {loading ? t("tools.mining.mining") : t("tools.mining.mine")}
        </button>

        {activePair && (
          <button onClick={() => {
            clearToolHistory(activePair.id, "mining");
            setResult(null); handleInputChange(""); setWordIdMap(new Map()); useAppStore.getState().setToolResult("mining", null);
          }} className="flex items-center px-4 py-2.5 text-gray-400 hover:text-red-500 text-sm rounded-xl transition-colors" title={t("common.clear")}>
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {!result && !loading && !error && (
        <ExamplePreview onClick={() => { handleInputChange(MINING_SAMPLE_INPUT); }}>
          <div className="space-y-4">
            {MINING_EXAMPLE.map((sentence, idx) => (
              <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">{sentence.sentence}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{sentence.translation}</p>
                  {sentence.grammar && (
                    <div className="mt-2 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-700/50">
                      <p className="text-[11px] text-gray-600 dark:text-gray-400">
                        <span className="font-semibold">Grammar:</span> {sentence.grammar}
                      </p>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sentence.keyWords.map((kw, ki) => (
                    <div key={ki} className="flex items-center gap-3 px-4 py-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{kw.level}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{kw.word}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">— {kw.translation}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ExamplePreview>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Mined results */}
      {result && result.map((sentence, idx) => (
        <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          {/* Sentence header */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1" onClick={(e) => {
                const el = (e.target as HTMLElement).closest("[data-clickable-word]");
                if (el) onWordClick?.(el.getAttribute("data-clickable-word") || "");
              }}>
                <p
                  className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderClickable(`**${sentence.sentence}**`) }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{sentence.translation}</p>
              </div>
            </div>
            {/* Grammar point */}
            {sentence.grammar ? (
              <div className="mt-2 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-700/50">
                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                  <span className="font-semibold">{t("tools.mining.grammarPoint")}:</span> {sentence.grammar}
                </p>
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic mt-2 inline-block">{t("tools.mining.noGrammarPoint", "—")}</span>
            )}
          </div>

          {/* Key words */}
          {sentence.keyWords && sentence.keyWords.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {sentence.keyWords.map((kw, ki) => (
                <div key={ki} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${levelColors[kw.level] || levelColors.B1}`}>{kw.level}</span>
                  <span
                    className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer hover:text-amber-600 dark:hover:text-amber-400"
                    onClick={() => onWordClick?.(kw.word)}
                  >
                    {kw.word}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 flex-1">— {kw.translation}</span>
                  <KeywordActions
                    word={kw.word}
                    resolveWordId={resolveWordId}
                    favoriteIds={favoriteIds}
                    toggleFavorite={toggleFavorite}
                    pairId={activePair?.id}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
