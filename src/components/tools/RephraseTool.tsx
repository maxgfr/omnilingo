import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Copy, Check } from "lucide-react";
import { cachedAskAi, getPromptContext } from "../../lib/ai-cache";
import { parseAiJson, formatMessage } from "../../lib/markdown";
import type { LanguagePair } from "../../types";

interface RephraseAlternative { text: string; tone: string; note: string; }
interface RephraseResult { alternatives: RephraseAlternative[]; }

const TONE_STYLES: Record<string, { bg: string; text: string }> = {
  formal: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" },
  informal: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
  simple: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
  professional: { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-400" },
  creative: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400" },
  academic: { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-400" },
  polite: { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-400" },
  casual: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
  neutral: { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-400" },
};

interface ToolProps { onWordClick?: (word: string) => void; initialWord?: string; activePair?: LanguagePair | null; }

export default function RephraseTool({ initialWord, activePair }: ToolProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState(initialWord || "");
  const [structured, setStructured] = useState<RephraseResult | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleRephrase = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true); setStructured(null); setFallback(null);
    try {
      const level = "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);
      const prompt = `Student learning ${srcName} at ${level}. Rephrase text, return JSON:
{"alternatives":[{"text":"rephrased in ${srcName}","tone":"formal|informal|simple|professional|creative|academic|polite|casual","note":"what changed, in ${tgtName}"}]}
3-5 diverse alternatives with different tones. ONLY valid JSON.
${enriched}
Text: ${input.trim()}`;
      const response = await cachedAskAi("rephrase", input.trim(), activePair.id, prompt);
      const parsed = parseAiJson<RephraseResult>(response);
      if (parsed?.alternatives?.length) setStructured(parsed); else setFallback(response);
    } catch (err) { setFallback(`Error: ${err}`); }
    finally { setLoading(false); }
  }, [input, loading, activePair]);

  useEffect(() => { if (initialWord) handleRephrase(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = (text: string, idx: number) => { navigator.clipboard.writeText(text); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRephrase(); } };

  return (
    <div className="space-y-4">
      <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("tools.rephrase.inputPlaceholder")} rows={3} className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-colors" />
      <button onClick={handleRephrase} disabled={!input.trim() || loading} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? <><Loader2 size={16} className="animate-spin" />{t("tools.rephrase.rephrasing")}</> : t("tools.rephrase.rephrase")}
      </button>

      {structured && (
        <div className="space-y-3">
          {structured.alternatives.map((alt, i) => {
            const ts = TONE_STYLES[alt.tone] || TONE_STYLES.neutral;
            return (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${ts.bg} ${ts.text}`}>{alt.tone}</span>
                    <p className="text-sm text-gray-900 dark:text-white leading-relaxed mt-2">{alt.text}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">{alt.note}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => handleCopy(alt.text, i)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">{copiedIdx === i ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-gray-400" />}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {fallback && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm"><div className="prose prose-sm dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: formatMessage(fallback) }} /></div>}
    </div>
  );
}
