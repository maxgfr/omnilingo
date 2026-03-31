import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, BookOpenCheck, Plus, Check } from "lucide-react";
import { useApp } from "../../store/AppContext";
import { cachedAskAi, addToHistory, getPromptContext } from "../../lib/ai-cache";
import { parseAiJson, formatMessage, renderClickable } from "../../lib/markdown";
import * as bridge from "../../lib/bridge";

interface AnalyzedWord {
  word: string;
  translation: string;
  level: string;
}

interface ReaderResult {
  level: string;
  summary: string;
  vocabulary: AnalyzedWord[];
  annotated: string; // text with **unknown words** highlighted
}

interface ToolProps {
  onWordClick?: (word: string) => void;
}

export default function ReaderTool({ onWordClick }: ToolProps) {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();
  const [input, setInput] = useState("");
  const [structured, setStructured] = useState<ReaderResult | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const handleAnalyze = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true);
    setStructured(null);
    setFallback(null);
    setAddedIds(new Set());

    try {
      const level = settings?.level || "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);
      const prompt = `The student is learning ${srcName} at ${level} level.
Analyze the following ${srcName} text for a language learner. Return JSON:

{
  "level": "estimated CEFR level of this text (A1/A2/B1/B2/C1/C2)",
  "summary": "Brief summary of the text content in ${tgtName} (1-2 sentences)",
  "vocabulary": [
    {"word": "difficult/key word in ${srcName}", "translation": "translation in ${tgtName}", "level": "A1|A2|B1|B2|C1"},
    ...up to 15 key vocabulary items, sorted by difficulty
  ],
  "annotated": "The original text with **difficult or key words** wrapped in double asterisks"
}

Rules:
- vocabulary: Extract words that a ${level} student might not know, plus key topic words
- annotated: Reproduce the EXACT original text but wrap important/difficult words with **asterisks**
- Include common words if they have tricky usage in this context
- Return ONLY valid JSON
${enriched}

Text to analyze:
${input.trim()}`;
      addToHistory(activePair.id, "reader", input.trim().slice(0, 50));
      const response = await cachedAskAi("reader", input.trim(), activePair.id, prompt);
      const parsed = parseAiJson<ReaderResult>(response);
      if (parsed?.vocabulary?.length) {
        setStructured(parsed);
      } else {
        setFallback(response);
      }
    } catch (err) {
      setFallback(`Error: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [input, loading, activePair, settings]);

  const handleAddWord = async (word: string) => {
    if (!activePair || addedIds.has(word)) return;
    try {
      const words = await bridge.searchWords(activePair.id, word);
      if (words.length > 0) {
        await bridge.addWordToSrs(words[0].id);
      }
      setAddedIds((prev) => new Set(prev).add(word));
    } catch { /* ignore */ }
  };

  const handleResultClick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-clickable-word]");
    if (el) {
      const word = el.getAttribute("data-clickable-word");
      if (word && onWordClick) onWordClick(word);
    }
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
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t("tools.reader.inputPlaceholder")}
        rows={6}
        className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y transition-colors"
      />

      <button
        onClick={handleAnalyze}
        disabled={!input.trim() || loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <><Loader2 size={16} className="animate-spin" />{t("tools.reader.analyzing")}</> : <><BookOpenCheck size={16} />{t("tools.reader.analyze")}</>}
      </button>

      {structured && (
        <div className="space-y-4">
          {/* Level + summary */}
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${LEVEL_COLORS[structured.level] || LEVEL_COLORS.B1}`}>
              {structured.level}
            </span>
            <p className="text-sm text-gray-700 dark:text-gray-300">{structured.summary}</p>
          </div>

          {/* Annotated text */}
          {structured.annotated && (
            <div
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm text-sm leading-relaxed text-gray-900 dark:text-gray-100"
              onClick={handleResultClick}
              dangerouslySetInnerHTML={{ __html: renderClickable(structured.annotated) }}
            />
          )}

          {/* Vocabulary extraction */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("tools.reader.vocabulary")}</span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {structured.vocabulary.map((v, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${LEVEL_COLORS[v.level] || LEVEL_COLORS.B1}`}>{v.level}</span>
                  <span
                    className="font-medium text-sm text-gray-900 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    onClick={() => onWordClick?.(v.word)}
                  >
                    {v.word}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">— {v.translation}</span>
                  <button
                    onClick={() => handleAddWord(v.word)}
                    disabled={addedIds.has(v.word)}
                    className={`ml-auto flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      addedIds.has(v.word)
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    {addedIds.has(v.word) ? <Check size={10} /> : <Plus size={10} />}
                    {addedIds.has(v.word) ? t("common.added") : "+ SRS"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {fallback && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-gray-900 dark:text-gray-100" dangerouslySetInnerHTML={{ __html: formatMessage(fallback) }} />
        </div>
      )}
    </div>
  );
}
