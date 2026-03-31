import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, Loader2, Copy, Check, Volume2 } from "lucide-react";
import { useApp } from "../../store/AppContext";
import { cachedAskAi, addToHistory, getPromptContext } from "../../lib/ai-cache";
import { renderClickable, parseAiJson, formatMessage } from "../../lib/markdown";
import { speak } from "../../lib/speech";

interface TranslateResult {
  translation: string;
  alternatives?: { text: string; context: string }[];
  examples?: { source: string; target: string }[];
}

interface ToolProps { onWordClick?: (word: string) => void; initialWord?: string; }

export default function TranslateTool({ onWordClick, initialWord }: ToolProps) {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();
  const [input, setInput] = useState(initialWord || "");
  const [structured, setStructured] = useState<TranslateResult | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reversed, setReversed] = useState(false);
  const [copied, setCopied] = useState(false);

  const sourceName = reversed ? activePair?.target_name : activePair?.source_name;
  const targetName = reversed ? activePair?.source_name : activePair?.target_name;
  const targetLang = reversed ? activePair?.source_lang : activePair?.target_lang;

  const handleTranslate = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true);
    setStructured(null);
    setFallback(null);
    try {
      const level = settings?.level || "A2";
      const enriched = await getPromptContext(activePair.id);
      const prompt = `Translate from ${sourceName} to ${targetName}. Student CEFR level: ${level}.
Return JSON: {"translation":"main translation","alternatives":[{"text":"alt","context":"when"}],"examples":[{"source":"sentence with **word**","target":"translation with **equiv**"}]}
Rules: 1-3 alternatives if relevant, 2-4 realistic bilingual examples with **bold** key words, ONLY valid JSON.
${enriched}
Text: ${input.trim()}`;
      addToHistory(activePair.id, "translate", input.trim());
      const response = await cachedAskAi("translate", input.trim(), activePair.id, prompt);
      const parsed = parseAiJson<TranslateResult>(response);
      if (parsed?.translation) setStructured(parsed); else setFallback(response);
    } catch (err) { setFallback(`Error: ${err}`); }
    finally { setLoading(false); }
  }, [input, loading, activePair, settings, sourceName, targetName]);

  useEffect(() => { if (initialWord) handleTranslate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = () => { navigator.clipboard.writeText(structured?.translation || ""); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTranslate(); } };
  const handleResultClick = (e: React.MouseEvent) => { const el = (e.target as HTMLElement).closest("[data-clickable-word]"); if (el) { const w = el.getAttribute("data-clickable-word"); if (w && onWordClick) onWordClick(w); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{sourceName}</span>
        <button onClick={() => { setReversed(!reversed); setStructured(null); setFallback(null); }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title={t("tools.translate.swap")}>
          <ArrowLeftRight size={16} className="text-gray-500" />
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{targetName}</span>
      </div>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("tools.translate.inputPlaceholder")} rows={4} className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-colors" />
      <button onClick={handleTranslate} disabled={!input.trim() || loading} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? <><Loader2 size={16} className="animate-spin" />{t("tools.translate.translating")}</> : t("tools.translate.translate")}
      </button>

      {structured && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-semibold text-gray-900 dark:text-white leading-relaxed flex-1">{structured.translation}</p>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => speak(structured.translation, targetLang || "fr")} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><Volume2 size={16} className="text-gray-500" /></button>
                <button onClick={handleCopy} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">{copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} className="text-gray-500" />}</button>
              </div>
            </div>
            {structured.alternatives && structured.alternatives.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                {structured.alternatives.map((alt, i) => (
                  <div key={i} className="flex items-baseline gap-2"><span className="text-sm font-medium text-gray-800 dark:text-gray-200">{alt.text}</span><span className="text-xs text-gray-500 dark:text-gray-400 italic">— {alt.context}</span></div>
                ))}
              </div>
            )}
          </div>
          {structured.examples && structured.examples.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden" onClick={handleResultClick}>
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700"><span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t("tools.translate.examples")}</span></div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {structured.examples.map((ex, i) => (
                  <div key={i} className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <p className="text-sm text-gray-900 dark:text-gray-100" dangerouslySetInnerHTML={{ __html: renderClickable(ex.source) }} />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic" dangerouslySetInnerHTML={{ __html: renderClickable(ex.target) }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {fallback && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm"><div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-gray-900 dark:text-gray-100" dangerouslySetInnerHTML={{ __html: formatMessage(fallback) }} /></div>}
    </div>
  );
}
