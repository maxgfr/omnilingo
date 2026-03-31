import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2, Volume2 } from "lucide-react";
import { useApp } from "../../store/AppContext";
import { cachedAskAi, addToHistory, getPromptContext } from "../../lib/ai-cache";
import { renderClickable, parseAiJson, formatMessage } from "../../lib/markdown";
import { speak } from "../../lib/speech";
import ExerciseBox from "./ExerciseBox";
import type { Exercise } from "./ExerciseBox";

interface DefinitionEntry { meaning: string; register?: string; example: { source: string; target: string }; }
interface DefinitionResult { word: string; pos: string; gender?: string; plural?: string; pronunciation?: string; definitions: DefinitionEntry[]; etymology?: string; related?: string[]; }

interface ToolProps { onWordClick?: (word: string) => void; initialWord?: string; }

export default function DefinitionTool({ onWordClick, initialWord }: ToolProps) {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();
  const [input, setInput] = useState(initialWord || "");
  const [structured, setStructured] = useState<DefinitionResult | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true); setStructured(null); setFallback(null);
    try {
      const level = settings?.level || "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);
      const prompt = `Student learning ${srcName} at ${level}. Definition for "${input.trim()}", return JSON:
{"word":"${input.trim()}","pos":"noun|verb|adj|...","gender":"m|f|n|null","plural":"plural|null","pronunciation":"IPA","definitions":[{"meaning":"in ${tgtName}","register":"general|formal|informal|technical","example":{"source":"sentence with **${input.trim()}** bold","target":"translation with **equiv** bold"}}],"etymology":"origin","related":["word1","word2"]}
1-5 definitions, each with a realistic example. 3-8 related words. ONLY valid JSON.
${enriched}`;
      addToHistory(activePair.id, "definition", input.trim());
      const response = await cachedAskAi("definition", input.trim(), activePair.id, prompt);
      const parsed = parseAiJson<DefinitionResult>(response);
      if (parsed?.definitions?.length) setStructured(parsed); else setFallback(response);
    } catch (err) { setFallback(`Error: ${err}`); }
    finally { setLoading(false); }
  }, [input, loading, activePair, settings]);

  useEffect(() => { if (initialWord) handleSearch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } };
  const handleResultClick = (e: React.MouseEvent) => { const el = (e.target as HTMLElement).closest("[data-clickable-word]"); if (el) { const w = el.getAttribute("data-clickable-word"); if (w && onWordClick) onWordClick(w); } };

  // MCQ exercise: given a definition, pick the correct word from related + actual word
  const exercise = useMemo((): Exercise | null => {
    if (!structured?.definitions?.length || !structured.related?.length || structured.related.length < 2) return null;
    const def = structured.definitions[0];
    const options = [structured.word, ...structured.related.slice(0, 3)].sort(() => Math.random() - 0.5);
    return { type: "mcq", question: def.meaning, options, correctIndex: options.indexOf(structured.word) };
  }, [structured]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("tools.definition.inputPlaceholder")} className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors" />
        </div>
        <button onClick={handleSearch} disabled={!input.trim() || loading} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <><Loader2 size={16} className="animate-spin" />{t("tools.definition.searching")}</> : t("tools.definition.search")}
        </button>
      </div>

      {structured && (
        <div className="space-y-4">
          {/* Word header */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => speak(structured.word, activePair?.source_lang || "de")} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><Volume2 size={18} className="text-indigo-500" /></button>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{structured.word}</h2>
              {structured.pronunciation && <span className="text-sm text-gray-500 dark:text-gray-400 italic">[{structured.pronunciation}]</span>}
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">{structured.pos}</span>
              {structured.gender && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${structured.gender === "m" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" : structured.gender === "f" ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>
                  {structured.gender === "m" ? "masculin" : structured.gender === "f" ? "féminin" : "neutre"}
                </span>
              )}
              {structured.plural && <span className="text-sm text-gray-500 dark:text-gray-400">pl. <span className="font-medium">{structured.plural}</span></span>}
            </div>
          </div>

          {/* Definitions */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden" onClick={handleResultClick}>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {structured.definitions.map((def, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold">{i + 1}</span>
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">{def.meaning}</p>
                    {def.register && def.register !== "general" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{def.register}</span>}
                  </div>
                  <div className="ml-9 border-l-2 border-indigo-200 dark:border-indigo-800 pl-3">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderClickable(def.example.source) }} />
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderClickable(def.example.target) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Etymology + Related */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {structured.etymology && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("tools.definition.etymology")}</span><p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{structured.etymology}</p></div>}
            {structured.related && structured.related.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("tools.definition.related")}</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {structured.related.map((w, i) => (
                    <span key={i} onClick={() => onWordClick?.(w)} className="text-sm px-2.5 py-1 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-600 dark:hover:text-indigo-400 transition-colors">{w}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {exercise && <ExerciseBox exercise={exercise} />}
        </div>
      )}
      {fallback && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm"><div className="prose prose-sm dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: formatMessage(fallback) }} /></div>}
    </div>
  );
}
