import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, ChevronLeft, BookOpen } from "lucide-react";
import { cachedAskAi, addToHistory, getPromptContext, clearToolHistory } from "../../lib/ai-cache";
import { renderClickable, parseAiJson, formatMessage } from "../../lib/markdown";
import type { LanguagePair } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import ExamplePreview from "../ui/ExamplePreview";
import RecentSearches from "../ui/RecentSearches";
import { SYNONYMS_EXAMPLE } from "../../lib/exampleData";
import { useExampleTranslations } from "../../lib/useExampleTranslations";

interface SynonymEntry { word: string; register: string; definition: string; example: { source: string; target: string }; }
interface SynonymsResult { synonyms: SynonymEntry[]; antonyms?: { word: string; definition: string }[]; }

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
  const navigate = useNavigate();
  const [input, setInput] = useState(initialWord || "");

  const handleInputChange = (value: string) => {
    setInput(value);
    onInputChange?.(value);
  };
  const cachedResult = useAppStore.getState().toolResultCache["synonyms"];
  const [structured, setStructured] = useState<SynonymsResult | null>(() => {
    if (cachedResult) try { const p = JSON.parse(cachedResult); return p.structured ?? null; } catch { return null; }
    return null;
  });
  const [fallback, setFallback] = useState<string | null>(() => {
    if (cachedResult) try { const p = JSON.parse(cachedResult); return p.fallback ?? null; } catch { return null; }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Translate example into the active target language
  const { tr: trEx, loading: trExLoading } = useExampleTranslations(
    "synonyms",
    [
      SYNONYMS_EXAMPLE.sampleInput,
      ...SYNONYMS_EXAMPLE.synonyms.flatMap((s) => [
        s.word,
        s.definition,
        s.example.source,
        s.example.target,
      ]),
    ],
  );

  useEffect(() => {
    if (structured || fallback) {
      useAppStore.getState().setToolResult("synonyms", JSON.stringify({ structured, fallback }));
    }
  }, [structured, fallback]);

  const handleSearch = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true); setStructured(null); setFallback(null);
    try {
      const level = "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);
      const prompt = `Find ${tgtName} synonyms and antonyms for "${input.trim()}" for a ${srcName}-speaking ${level} learner.

Return ONLY this JSON, no markdown fences:
{
  "synonyms": [
    {
      "word": "<${tgtName} synonym>",
      "register": "formal" | "neutral" | "informal" | "literary" | "colloquial" | "technical",
      "definition": "<short meaning in ${srcName}>",
      "example": {
        "source": "<${tgtName} sentence with **synonym** in bold>",
        "target": "<${srcName} translation with **equivalent** in bold>"
      }
    }
  ],
  "antonyms": [
    { "word": "<${tgtName} antonym>", "definition": "<short meaning in ${srcName}>" }
  ]
}

Rules:
- 5-10 synonyms ordered from most common to most rare.
- 3-5 antonyms when applicable, otherwise empty array.
- Examples must clearly show the word in context.
${enriched}`;
      addToHistory(activePair.id, "synonyms", input.trim());
      const response = await cachedAskAi("synonyms", input.trim(), activePair.id, prompt);
      const parsed = parseAiJson<SynonymsResult>(response);
      if (parsed?.synonyms?.length) setStructured(parsed); else setFallback(response);
    } catch (err) { setFallback(`${t("common.error")}: ${err}`); }
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
        {activePair && (structured || fallback) && (
          <button onClick={() => {
            clearToolHistory(activePair.id, "synonyms");
            setStructured(null); setFallback(null); handleInputChange(""); useAppStore.getState().setToolResult("synonyms", null);
          }} className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-amber-400 dark:hover:border-amber-500 rounded-lg text-sm font-medium transition-colors">
            <ChevronLeft size={16} />
            {t("common.back")}
          </button>
        )}
      </div>

      {!structured && !fallback && !loading && (
        <ExamplePreview loading={trExLoading} onClick={() => { handleInputChange(trEx(SYNONYMS_EXAMPLE.sampleInput)); }}>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {SYNONYMS_EXAMPLE.synonyms.map((syn, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{trEx(syn.word)}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${REGISTER_STYLES[syn.register] || REGISTER_STYLES.neutral}`}>{syn.register}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 italic ml-auto">{trEx(syn.definition)}</span>
                  </div>
                  <div className="ml-8 border-l-2 border-amber-200 dark:border-amber-800 pl-3">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{trEx(syn.example.source)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{trEx(syn.example.target)}</p>
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        useAppStore.getState().setDictionaryCache({ searchQuery: syn.word, selectedWordId: null, aiContent: null });
                        navigate("/dictionary");
                      }}
                      className="p-1 rounded text-gray-400 hover:text-amber-500 transition-colors"
                      title={t("tools.synonyms.viewInDictionary")}
                    >
                      <BookOpen size={12} />
                    </button>
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
          {structured?.antonyms && structured.antonyms.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t("tools.synonyms.antonyms")}
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {structured.antonyms.map((ant, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <span className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-amber-600" onClick={() => onWordClick?.(ant.word)}>{ant.word}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        useAppStore.getState().setDictionaryCache({ searchQuery: ant.word, selectedWordId: null, aiContent: null });
                        navigate("/dictionary");
                      }}
                      className="p-1 rounded text-gray-400 hover:text-amber-500 transition-colors"
                      title={t("tools.synonyms.viewInDictionary")}
                    >
                      <BookOpen size={12} />
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400 italic">{ant.definition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {fallback && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm"><div className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5" dangerouslySetInnerHTML={{ __html: formatMessage(fallback) }} /></div>}
    </div>
  );
}
