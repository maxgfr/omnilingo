import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2, Pickaxe,
  Trash2, AlertTriangle,
} from "lucide-react";
import { cachedAskAi, getCachedResult, addToHistory, getPromptContext, clearToolHistory } from "../../lib/ai-cache";
import type { LanguagePair } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import { parseAiJson, renderClickable } from "../../lib/markdown";
import ExamplePreview from "../ui/ExamplePreview";
import RecentSearches from "../ui/RecentSearches";

import { MINING_EXAMPLE, MINING_SAMPLE_INPUT } from "../../lib/exampleData";
import { useExampleTranslations } from "../../lib/useExampleTranslations";
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

  // Translate example into the active target language
  const { tr: trEx, loading: trExLoading } = useExampleTranslations(
    "mining",
    [
      MINING_SAMPLE_INPUT,
      ...MINING_EXAMPLE.flatMap((s) => [
        s.sentence,
        s.translation,
        s.grammar,
        ...s.keyWords.flatMap((kw) => [kw.word, kw.translation]),
      ]),
    ],
  );

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

    try {
      const level = "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);

      const prompt = `Mine the most useful sentences from this ${tgtName} text for a ${srcName}-speaking ${level} learner.

Return ONLY this JSON array, no markdown fences:
[
  {
    "sentence": "<sentence verbatim from text in ${tgtName}>",
    "translation": "<translation in ${srcName}>",
    "keyWords": [
      { "word": "<key word in ${tgtName}>", "translation": "<in ${srcName}>", "level": "A1" | "A2" | "B1" | "B2" | "C1" }
    ],
    "grammar": "<1 sentence in ${srcName} naming the main grammar point>"
  }
]

Rules:
- Select 3-8 sentences. Pick those that are SHORT, NATURAL, and rich in useful vocabulary or grammar.
- Each sentence must appear verbatim in the original text.
- 2-4 key words per sentence (focus on words a ${level} learner doesn't yet know).
- "grammar" should name a single concept (e.g. "passé composé", "modal verbs", "comparative"), not a long explanation.
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
            setResult(null); handleInputChange(""); useAppStore.getState().setToolResult("mining", null);
          }} className="flex items-center px-4 py-2.5 text-gray-400 hover:text-red-500 text-sm rounded-xl transition-colors" title={t("common.clear")}>
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {!result && !loading && !error && (
        <ExamplePreview loading={trExLoading} onClick={() => { handleInputChange(trEx(MINING_SAMPLE_INPUT)); }}>
          <div className="space-y-4">
            {MINING_EXAMPLE.map((sentence, idx) => (
              <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">{trEx(sentence.sentence)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{trEx(sentence.translation)}</p>
                  {sentence.grammar && (
                    <div className="mt-2 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-700/50">
                      <p className="text-[11px] text-gray-600 dark:text-gray-400">
                        <span className="font-semibold">{t("tools.mining.grammarPoint")}:</span> {trEx(sentence.grammar)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sentence.keyWords.map((kw, ki) => (
                    <div key={ki} className="flex items-center gap-3 px-4 py-2">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${levelColors[kw.level] || "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"}`}>{kw.level}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{trEx(kw.word)}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">— {trEx(kw.translation)}</span>
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
              <span className="text-xs text-gray-400 italic mt-2 inline-block">{t("tools.mining.noGrammarPoint")}</span>
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
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
