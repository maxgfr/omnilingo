import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2 } from "lucide-react";
import { cachedAskAi, addToHistory, getPromptContext } from "../../lib/ai-cache";
import { renderClickable, parseAiJson, formatMessage } from "../../lib/markdown";
import type { LanguagePair } from "../../types";
import ExamplePreview from "../ui/ExamplePreview";
import RecentSearches from "../ui/RecentSearches";
import { SYNONYMS_EXAMPLE } from "../../lib/exampleData";

interface SynonymEntry { word: string; register: string; definition: string; example: { source: string; target: string }; }
interface SynonymsResult { synonyms: SynonymEntry[]; }

const REGISTER_STYLES: Record<string, string> = {
  formal: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  neutral: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
  informal: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  literary: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  colloquial: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  technical: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400",
};

interface ToolProps { onWordClick?: (word: string) => void; initialWord?: string; activePair?: LanguagePair | null; onInputChange?: (value: string) => void; }

export default function SynonymsTool({ onWordClick, initialWord, activePair, onInputChange }: ToolProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState(initialWord || "");

  const handleInputChange = (value: string) => {
    setInput(value);
    onInputChange?.(value);
  };
  const [structured, setStructured] = useState<SynonymsResult | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true); setStructured(null); setFallback(null);
    try {
      const level = "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);
      const prompt = `Student learning ${srcName} at ${level}. Synonyms for "${input.trim()}", return JSON:
{"synonyms":[{"word":"synonym","register":"formal|neutral|informal|literary|colloquial|technical","definition":"meaning in ${tgtName}","example":{"source":"sentence with **synonym** bold","target":"translation with **equiv** bold"}}]}
5-10 synonyms sorted by relevance. ONLY valid JSON.
${enriched}`;
      addToHistory(activePair.id, "synonyms", input.trim());
      const response = await cachedAskAi("synonyms", input.trim(), activePair.id, prompt);
      const parsed = parseAiJson<SynonymsResult>(response);
      if (parsed?.synonyms?.length) setStructured(parsed); else setFallback(response);
    } catch (err) { setFallback(`Error: ${err}`); }
    finally { setLoading(false); }
  }, [input, loading, activePair]);

  useEffect(() => { if (initialWord) handleSearch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } };
  const handleResultClick = (e: React.MouseEvent) => { const el = (e.target as HTMLElement).closest("[data-clickable-word]"); if (el) { const w = el.getAttribute("data-clickable-word"); if (w && onWordClick) onWordClick(w); } };


  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={input} onChange={(e) => handleInputChange(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => !input.trim() && setShowHistory(true)} onBlur={() => setTimeout(() => setShowHistory(false), 150)} placeholder={t("tools.synonyms.inputPlaceholder")} autoComplete="off" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-colors" />
          {activePair && <RecentSearches tool="synonyms" pairId={activePair.id} visible={showHistory && !input.trim()} onSelect={(q) => { handleInputChange(q); setShowHistory(false); }} />}
        </div>
        <button onClick={handleSearch} disabled={!input.trim() || loading} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <><Loader2 size={16} className="animate-spin" />{t("tools.synonyms.searching")}</> : t("tools.synonyms.search")}
        </button>
      </div>

      {!structured && !fallback && !loading && (
        <ExamplePreview onClick={() => { handleInputChange(SYNONYMS_EXAMPLE.sampleInput); }}>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {SYNONYMS_EXAMPLE.synonyms.map((syn, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{syn.word}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${REGISTER_STYLES[syn.register] || REGISTER_STYLES.neutral}`}>{syn.register}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 italic ml-auto">{syn.definition}</span>
                  </div>
                  <div className="ml-8 border-l-2 border-amber-200 dark:border-amber-800 pl-3">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{syn.example.source}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{syn.example.target}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ExamplePreview>
      )}

      {structured && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden" onClick={handleResultClick}>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {structured.synonyms.map((syn, i) => (
                <div key={i} className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-amber-600 dark:hover:text-amber-400" onClick={(e) => { e.stopPropagation(); onWordClick?.(syn.word); }}>{syn.word}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${REGISTER_STYLES[syn.register] || REGISTER_STYLES.neutral}`}>{syn.register}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 italic ml-auto">{syn.definition}</span>
                  </div>
                  <div className="ml-8 border-l-2 border-amber-200 dark:border-amber-800 pl-3">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderClickable(syn.example.source) }} />
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderClickable(syn.example.target) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {fallback && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm"><div className="prose prose-sm dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: formatMessage(fallback) }} /></div>}
    </div>
  );
}
