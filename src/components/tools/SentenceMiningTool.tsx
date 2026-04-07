import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2, Pickaxe, Plus, Check,
  BookOpenCheck, Trash2, Save,
} from "lucide-react";
import * as bridge from "../../lib/bridge";
import { cachedAskAi, addToHistory, getPromptContext } from "../../lib/ai-cache";
import type { LanguagePair } from "../../types";
import { parseAiJson, renderClickable } from "../../lib/markdown";

interface MinedSentence {
  sentence: string;
  translation: string;
  keyWords: { word: string; translation: string; level: string }[];
  grammar: string;
}

interface SavedSentence {
  sentence: string;
  translation: string;
  timestamp: number;
}

const STORAGE_KEY = "omnilingo-mined-sentences";

function getSavedSentences(pairId: number): SavedSentence[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${pairId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSentences(pairId: number, sentences: SavedSentence[]) {
  localStorage.setItem(`${STORAGE_KEY}-${pairId}`, JSON.stringify(sentences.slice(0, 50)));
}

interface ToolProps {
  onWordClick?: (word: string) => void;
  activePair?: LanguagePair | null;
}

export default function SentenceMiningTool({ onWordClick, activePair }: ToolProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<MinedSentence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedSentences, setSavedSentences] = useState<SavedSentence[]>([]);
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (activePair) setSavedSentences(getSavedSentences(activePair.id));
  }, [activePair]);

  const handleMine = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true);
    setResult(null);
    setSavedIndices(new Set());
    setAddedWords(new Set());

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
    } finally {
      setLoading(false);
    }
  }, [input, loading, activePair]);

  const handleSaveSentence = (idx: number, sentence: MinedSentence) => {
    if (!activePair || savedIndices.has(idx)) return;
    const saved: SavedSentence = {
      sentence: sentence.sentence,
      translation: sentence.translation,
      timestamp: Date.now(),
    };
    const updated = [saved, ...savedSentences].slice(0, 50);
    setSavedSentences(updated);
    saveSentences(activePair.id, updated);
    setSavedIndices((prev) => new Set(prev).add(idx));
  };

  const handleAddWord = async (word: string) => {
    if (!activePair || addedWords.has(word)) return;
    try {
      const words = await bridge.searchWords(activePair.id, word);
      if (words.length > 0) {
        await bridge.addWordToSrs(words[0].id);
      }
      setAddedWords((prev) => new Set(prev).add(word));
    } catch { /* ignore */ }
  };

  const handleDeleteSaved = (idx: number) => {
    if (!activePair) return;
    const updated = savedSentences.filter((_, i) => i !== idx);
    setSavedSentences(updated);
    saveSentences(activePair.id, updated);
  };

  const LEVEL_COLORS: Record<string, string> = {
    A1: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    A2: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    B1: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    B2: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
    C1: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",
    C2: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t("tools.mining.inputPlaceholder")}
        rows={6}
        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
      />

      <div className="flex gap-2">
        <button
          onClick={handleMine}
          disabled={!input.trim() || loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Pickaxe size={16} />}
          {loading ? t("tools.mining.mining") : t("tools.mining.mine")}
        </button>

        {savedSentences.length > 0 && (
          <button
            onClick={() => setShowSaved(!showSaved)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
              showSaved
                ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400"
                : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400"
            }`}
          >
            <BookOpenCheck size={16} />
            {t("tools.mining.saved")} ({savedSentences.length})
          </button>
        )}
      </div>

      {/* Saved sentences panel */}
      {showSaved && savedSentences.length > 0 && (
        <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/10 p-4 space-y-2">
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-2">
            {t("tools.mining.savedSentences")}
          </p>
          {savedSentences.map((s, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{s.sentence}</p>
                <p className="text-xs text-gray-500 italic">{s.translation}</p>
              </div>
              <button onClick={() => handleDeleteSaved(i)} className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20">
                <Trash2 size={12} className="text-rose-400" />
              </button>
            </div>
          ))}
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
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleSaveSentence(idx, sentence)}
                  disabled={savedIndices.has(idx)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    savedIndices.has(idx)
                      ? "text-emerald-500"
                      : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-teal-500"
                  }`}
                >
                  {savedIndices.has(idx) ? <Check size={14} /> : <Save size={14} />}
                </button>
              </div>
            </div>
            {/* Grammar point */}
            {sentence.grammar && (
              <div className="mt-2 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-700/50">
                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                  <span className="font-semibold">{t("tools.mining.grammarPoint")}:</span> {sentence.grammar}
                </p>
              </div>
            )}
          </div>

          {/* Key words */}
          {sentence.keyWords && sentence.keyWords.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {sentence.keyWords.map((kw, ki) => (
                <div key={ki} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEVEL_COLORS[kw.level] || LEVEL_COLORS.B1}`}>{kw.level}</span>
                  <span
                    className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer hover:text-teal-600 dark:hover:text-teal-400"
                    onClick={() => onWordClick?.(kw.word)}
                  >
                    {kw.word}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">— {kw.translation}</span>
                  <button
                    onClick={() => handleAddWord(kw.word)}
                    disabled={addedWords.has(kw.word)}
                    className={`ml-auto flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      addedWords.has(kw.word)
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-teal-600 hover:bg-teal-700 text-white"
                    }`}
                  >
                    {addedWords.has(kw.word) ? <Check size={10} /> : <Plus size={10} />}
                    {addedWords.has(kw.word) ? t("common.added") : "+ SRS"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
