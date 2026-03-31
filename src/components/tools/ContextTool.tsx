import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2, Plus, Check, Volume2 } from "lucide-react";
import { useApp } from "../../store/AppContext";
import * as bridge from "../../lib/bridge";
import { cachedAskAi, addToHistory, getPromptContext } from "../../lib/ai-cache";
import { renderClickable, parseAiJson, formatMessage } from "../../lib/markdown";
import { speak } from "../../lib/speech";
import ExerciseBox from "./ExerciseBox";
import type { Exercise } from "./ExerciseBox";
import type { Word } from "../../types";

interface ContextResult {
  definition: string;
  examples: { source: string; target: string }[];
  usage: string;
}

interface ToolProps { onWordClick?: (word: string) => void; initialWord?: string; }

export default function ContextTool({ onWordClick, initialWord }: ToolProps) {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();
  const [input, setInput] = useState(initialWord || "");
  const [structured, setStructured] = useState<ContextResult | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dictWord, setDictWord] = useState<Word | null>(null);
  const [addedToSrs, setAddedToSrs] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true);
    setStructured(null); setFallback(null); setDictWord(null); setAddedToSrs(false);
    try {
      const words = await bridge.searchWords(activePair.id, input.trim());
      if (words.length > 0) setDictWord(words[0]);
      const level = settings?.level || "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);
      const prompt = `Student learning ${srcName} at ${level}. Word: "${input.trim()}".
Return JSON: {"definition":"definition in ${tgtName}","examples":[{"source":"${srcName} sentence with **${input.trim()}** bold","target":"${tgtName} translation with **equiv** bold"}],"usage":"register, collocations, mistakes in ${tgtName}"}
5-8 diverse, realistic examples showing different contexts. ONLY valid JSON.
${enriched}`;
      addToHistory(activePair.id, "context", input.trim());
      const response = await cachedAskAi("context", input.trim(), activePair.id, prompt);
      const parsed = parseAiJson<ContextResult>(response);
      if (parsed?.examples?.length) setStructured(parsed); else setFallback(response);
    } catch (err) { setFallback(`Error: ${err}`); }
    finally { setLoading(false); }
  }, [input, loading, activePair, settings]);

  useEffect(() => { if (initialWord) handleSearch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddToSrs = async () => { if (!dictWord || addedToSrs) return; try { await bridge.addWordToSrs(dictWord.id); setAddedToSrs(true); } catch {} };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } };
  const handleResultClick = (e: React.MouseEvent) => { const el = (e.target as HTMLElement).closest("[data-clickable-word]"); if (el) { const w = el.getAttribute("data-clickable-word"); if (w && onWordClick) onWordClick(w); } };

  // Generate exercise from examples
  const exercise = useMemo((): Exercise | null => {
    if (!structured?.examples?.length || !input.trim()) return null;
    const ex = structured.examples[Math.floor(Math.random() * structured.examples.length)];
    const word = input.trim();
    const blanked = ex.source.replace(/\*\*/g, "").replace(new RegExp(word, "gi"), "___");
    if (!blanked.includes("___")) return null;
    return { type: "fill", sentence: blanked, answer: word, hint: ex.target.replace(/\*\*/g, "") };
  }, [structured, input]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("tools.context.inputPlaceholder")} className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors" />
        </div>
        <button onClick={handleSearch} disabled={!input.trim() || loading} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <><Loader2 size={16} className="animate-spin" />{t("tools.context.searching")}</> : t("tools.context.search")}
        </button>
      </div>

      {dictWord && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex-wrap">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{t("tools.context.foundInDict")}</span>
          <span className="font-semibold text-gray-900 dark:text-white">{dictWord.source_word}</span><span className="text-gray-400">→</span>
          <span className="text-gray-700 dark:text-gray-300">{dictWord.target_word}</span>
          {dictWord.gender && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{dictWord.gender}</span>}
          <button onClick={() => speak(dictWord.source_word, activePair?.source_lang || "de")} className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"><Volume2 size={14} className="text-emerald-600 dark:text-emerald-400" /></button>
          <button onClick={handleAddToSrs} disabled={addedToSrs} className="ml-auto flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors">
            {addedToSrs ? <Check size={12} /> : <Plus size={12} />}{addedToSrs ? t("common.added") : t("tools.context.addToSrs")}
          </button>
        </div>
      )}

      {structured && (
        <div className="space-y-4">
          {structured.definition && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("tools.context.definition")}</span><p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{structured.definition}</p></div>}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden" onClick={handleResultClick}>
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("tools.context.examples")}</span></div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {structured.examples.map((ex, i) => (
                <div key={i} className="px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderClickable(ex.source) }} />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderClickable(ex.target) }} />
                </div>
              ))}
            </div>
          </div>
          {structured.usage && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/10 p-4 shadow-sm"><span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">{t("tools.context.usage")}</span><p className="mt-1 text-sm text-gray-800 dark:text-gray-200">{structured.usage}</p></div>}
          {exercise && <ExerciseBox exercise={exercise} />}
        </div>
      )}
      {fallback && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm"><div className="prose prose-sm dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: formatMessage(fallback) }} /></div>}
    </div>
  );
}
