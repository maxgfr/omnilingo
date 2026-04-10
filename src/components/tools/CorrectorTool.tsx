import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Copy, Check, AlertTriangle, CheckCircle, Trash2, RotateCcw } from "lucide-react";
import { cachedAskAi, getCachedResult, addToHistory, getPromptContext, clearToolHistory } from "../../lib/ai-cache";
import { parseAiJson, formatMessage } from "../../lib/markdown";
import type { LanguagePair } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import ExamplePreview from "../ui/ExamplePreview";
import RecentSearches from "../ui/RecentSearches";
import { CORRECTOR_EXAMPLE } from "../../lib/exampleData";

interface CorrectorResult {
  corrected: string;
  corrections: { wrong: string; right: string; explanation: string }[];
  score: string;
  feedback: string;
}

const SCORE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  excellent: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", label: "Excellent" },
  good: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", label: "Good" },
  fair: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", label: "Fair" },
  poor: { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-400", label: "Needs work" },
};

interface ToolProps { onWordClick?: (word: string) => void; initialWord?: string; activePair?: LanguagePair | null; onInputChange?: (value: string) => void; }

export default function CorrectorTool({ initialWord, activePair, onInputChange }: ToolProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState(initialWord || "");

  const handleInputChange = (value: string) => {
    setInput(value);
    onInputChange?.(value);
  };
  const cachedResult = useAppStore.getState().toolResultCache["corrector"];
  const [structured, setStructured] = useState<CorrectorResult | null>(() => {
    if (cachedResult) try { const p = JSON.parse(cachedResult); return p.structured ?? null; } catch { return null; }
    return null;
  });
  const [fallback, setFallback] = useState<string | null>(() => {
    if (cachedResult) try { const p = JSON.parse(cachedResult); return p.fallback ?? null; } catch { return null; }
    return null;
  });
  const [loading, setLoading] = useState(false);

  // Sync results to Zustand
  useEffect(() => {
    if (structured || fallback) {
      useAppStore.getState().setToolResult("corrector", JSON.stringify({ structured, fallback }));
    }
  }, [structured, fallback]);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const pendingReCorrect = useRef(false);

  // Auto-trigger correction after re-correct sets input
  useEffect(() => {
    if (pendingReCorrect.current && input && !loading) {
      pendingReCorrect.current = false;
      handleCorrect();
    }
  }, [input]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore cached result on mount
  useEffect(() => {
    if (initialWord && activePair) {
      const cached = getCachedResult("corrector", initialWord, activePair.id);
      if (cached) {
        const parsed = parseAiJson<CorrectorResult>(cached);
        if (parsed?.corrected) setStructured(parsed);
        else setFallback(cached);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCorrect = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true); setStructured(null); setFallback(null);
    try {
      const level = "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);
      const prompt = `Student learning ${tgtName} at ${level}. Correct text, return JSON:
{"corrected":"corrected text","corrections":[{"wrong":"error","right":"fix","explanation":"why in ${srcName}"}],"score":"excellent|good|fair|poor","feedback":"overall in ${srcName}"}
Empty corrections if perfect. ONLY valid JSON.
${enriched}
Text: ${input.trim()}`;
      addToHistory(activePair.id, "corrector", input.trim());
      const response = await cachedAskAi("corrector", input.trim(), activePair.id, prompt);
      const parsed = parseAiJson<CorrectorResult>(response);
      if (parsed?.corrected) {
        setStructured(parsed);
      } else { setFallback(response); }
    } catch (err) { setFallback(`Error: ${err}`); }
    finally { setLoading(false); }
  }, [input, loading, activePair]);

  const handleCopy = () => { navigator.clipboard.writeText(structured?.corrected || ""); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCorrect(); } };
  const scoreStyle = structured ? SCORE_STYLES[structured.score] || SCORE_STYLES.fair : null;

  return (
    <div className="space-y-4">
      <div className="relative" ref={historyRef}>
        <textarea value={input} onChange={(e) => handleInputChange(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => !input.trim() && setShowHistory(true)} onBlur={() => setTimeout(() => setShowHistory(false), 150)} placeholder={t("tools.corrector.inputPlaceholder")} rows={3} autoComplete="off" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 resize-none transition-colors" />
        {activePair && <RecentSearches tool="corrector" pairId={activePair.id} visible={showHistory && !input.trim()} onSelect={(q) => { handleInputChange(q); setShowHistory(false); }} />}
      </div>
      <div className="flex gap-2">
        <button onClick={handleCorrect} disabled={!input.trim() || loading} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <><Loader2 size={16} className="animate-spin" />{t("tools.corrector.correcting")}</> : t("tools.corrector.correct")}
        </button>
        {structured && (
          <button
            onClick={() => {
              handleInputChange(structured.corrected);
              setStructured(null);
              setFallback(null);
                           pendingReCorrect.current = true;
            }}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600 text-sm font-medium rounded-lg transition-colors"
          >
            <RotateCcw size={16} />
            {t("tools.corrector.reCorrect", "Re-corriger")}
          </button>
        )}
        {activePair && (
          <button onClick={() => {
            clearToolHistory(activePair.id, "corrector");
            setStructured(null); setFallback(null); handleInputChange(""); useAppStore.getState().setToolResult("corrector", null);          }} className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-red-500 text-sm rounded-lg transition-colors" title={t("common.clear")}>
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {!structured && !fallback && !loading && (
        <ExamplePreview onClick={() => { handleInputChange(CORRECTOR_EXAMPLE.sampleInput); }}>
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Corrected version</span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Fair</span>
              </div>
              <p className="text-sm leading-relaxed text-gray-900 dark:text-white">{CORRECTOR_EXAMPLE.corrected}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Corrections</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {CORRECTOR_EXAMPLE.corrections.map((c, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-sm line-through text-rose-600 dark:text-rose-400">{c.wrong}</span>
                      <span className="text-gray-400">&rarr;</span>
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{c.right}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{c.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-gray-800 dark:text-gray-200">{CORRECTOR_EXAMPLE.feedback}</p>
            </div>
          </div>
        </ExamplePreview>
      )}

      {structured && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("tools.corrector.correctedVersion")}</span>
              <div className="flex items-center gap-2">
                {scoreStyle && <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${scoreStyle.bg} ${scoreStyle.text}`}>{scoreStyle.label}</span>}
                <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">{copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-gray-500" />}</button>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-900 dark:text-white">{structured.corrected}</p>
          </div>
          {structured.corrections.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("tools.corrector.corrections")}</span></div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {structured.corrections.map((c, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <div className="flex items-center gap-3 mb-1.5"><span className="text-sm line-through text-rose-600 dark:text-rose-400">{c.wrong}</span><span className="text-gray-400">→</span><span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{c.right}</span></div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{c.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {structured.corrections.length === 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"><CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400" /><span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t("tools.corrector.noErrors")}</span></div>
          )}
          {structured.feedback && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800"><AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" /><p className="text-sm text-gray-800 dark:text-gray-200">{structured.feedback}</p></div>
          )}
        </div>
      )}
      {fallback && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm"><div className="prose prose-sm dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: formatMessage(fallback) }} /></div>}
    </div>
  );
}
