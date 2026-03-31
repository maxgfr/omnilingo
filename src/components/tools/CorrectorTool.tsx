import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Copy, Check, AlertTriangle, CheckCircle } from "lucide-react";
import { useApp } from "../../store/AppContext";
import * as bridge from "../../lib/bridge";
import { cachedAskAi, getPromptContext } from "../../lib/ai-cache";
import { parseAiJson, formatMessage } from "../../lib/markdown";

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

interface ToolProps { onWordClick?: (word: string) => void; initialWord?: string; }

export default function CorrectorTool({ initialWord }: ToolProps) {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();
  const [input, setInput] = useState(initialWord || "");
  const [structured, setStructured] = useState<CorrectorResult | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCorrect = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true); setStructured(null); setFallback(null);
    try {
      const level = settings?.level || "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);
      const prompt = `Student learning ${srcName} at ${level}. Correct text, return JSON:
{"corrected":"corrected text","corrections":[{"wrong":"error","right":"fix","explanation":"why in ${tgtName}"}],"score":"excellent|good|fair|poor","feedback":"overall in ${tgtName}"}
Empty corrections if perfect. ONLY valid JSON.
${enriched}
Text: ${input.trim()}`;
      const response = await cachedAskAi("corrector", input.trim(), activePair.id, prompt);
      const parsed = parseAiJson<CorrectorResult>(response);
      if (parsed?.corrected) {
        setStructured(parsed);
        // Auto-feed errors to SRS stats
        if (parsed.corrections.length > 0) {
          for (const c of parsed.corrections) {
            bridge.logError(activePair.id, "grammar", c.wrong, c.wrong, c.right).catch(() => {});
          }
        }
      } else { setFallback(response); }
    } catch (err) { setFallback(`Error: ${err}`); }
    finally { setLoading(false); }
  }, [input, loading, activePair, settings]);

  const handleCopy = () => { navigator.clipboard.writeText(structured?.corrected || ""); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCorrect(); } };
  const scoreStyle = structured ? SCORE_STYLES[structured.score] || SCORE_STYLES.fair : null;

  return (
    <div className="space-y-4">
      <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("tools.corrector.inputPlaceholder")} rows={3} className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-colors" />
      <button onClick={handleCorrect} disabled={!input.trim() || loading} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? <><Loader2 size={16} className="animate-spin" />{t("tools.corrector.correcting")}</> : t("tools.corrector.correct")}
      </button>

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
