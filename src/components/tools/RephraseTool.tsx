import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Copy, Check, Trash2 } from "lucide-react";
import { cachedAskAi, addToHistory, getPromptContext, clearToolHistory } from "../../lib/ai-cache";
import { parseAiJson, formatMessage } from "../../lib/markdown";
import type { LanguagePair } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import ExamplePreview from "../ui/ExamplePreview";
import RecentSearches from "../ui/RecentSearches";
import { REPHRASE_EXAMPLE } from "../../lib/exampleData";
import { useExampleTranslations } from "../../lib/useExampleTranslations";

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

interface ToolProps { onWordClick?: (word: string) => void; initialWord?: string; activePair?: LanguagePair | null; onInputChange?: (value: string) => void; }

export default function RephraseTool({ initialWord, activePair, onInputChange }: ToolProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState(initialWord || "");

  const handleInputChange = (value: string) => {
    setInput(value);
    onInputChange?.(value);
  };
  const cachedResult = useAppStore.getState().toolResultCache["rephrase"];
  const [structured, setStructured] = useState<RephraseResult | null>(() => {
    if (cachedResult) try { const p = JSON.parse(cachedResult); return p.structured ?? null; } catch { return null; }
    return null;
  });
  const [fallback, setFallback] = useState<string | null>(() => {
    if (cachedResult) try { const p = JSON.parse(cachedResult); return p.fallback ?? null; } catch { return null; }
    return null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (structured || fallback) {
      useAppStore.getState().setToolResult("rephrase", JSON.stringify({ structured, fallback }));
    }
  }, [structured, fallback]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedTones, setSelectedTones] = useState<Set<string>>(new Set());

  // Translate example into the active target language
  const { tr: trEx, loading: trExLoading } = useExampleTranslations(
    "rephrase",
    [
      REPHRASE_EXAMPLE.sampleInput,
      ...REPHRASE_EXAMPLE.alternatives.flatMap((a) => [a.text, a.note]),
    ],
  );

  const handleRephrase = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true); setStructured(null); setFallback(null);
    try {
      const level = "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);
      const tonesStr = selectedTones.size > 0
        ? `Generate ONE alternative for each of these tones: ${[...selectedTones].join(", ")}.`
        : "Generate 3-5 alternatives with diverse tones.";
      const prompt = `Rephrase this ${tgtName} text in different ways for a ${srcName}-speaking ${level} learner.

Return ONLY this JSON, no markdown fences:
{
  "alternatives": [
    {
      "text": "<rephrased version in ${tgtName}>",
      "tone": "formal" | "informal" | "simple" | "professional" | "creative" | "academic" | "polite" | "casual",
      "note": "<1 short sentence in ${srcName} explaining what changed and when to use it>"
    }
  ]
}

${tonesStr}
${enriched}

Original text: ${input.trim()}`;
      addToHistory(activePair.id, "rephrase", input.trim());
      const response = await cachedAskAi("rephrase", input.trim(), activePair.id, prompt);
      const parsed = parseAiJson<RephraseResult>(response);
      if (parsed?.alternatives?.length) setStructured(parsed); else setFallback(response);
    } catch (err) { setFallback(`${t("common.error")}: ${err}`); }
    finally { setLoading(false); }
  }, [input, loading, activePair, selectedTones]);

  useEffect(() => { if (initialWord) handleRephrase(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const highlightDiff = (original: string, rephrased: string): React.ReactNode => {
    const origWords = original.split(/\s+/);
    const newWords = rephrased.split(/\s+/);
    return newWords.map((word, i) => {
      const isChanged = !origWords.includes(word.replace(/[.,!?;:]/g, ""));
      return (
        <span key={i}>
          {i > 0 && " "}
          {isChanged ? (
            <mark className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-0.5 rounded">
              {word}
            </mark>
          ) : word}
        </span>
      );
    });
  };

  const handleCopy = (text: string, idx: number) => { navigator.clipboard.writeText(text); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRephrase(); } };

  return (
    <div className="space-y-4">
      <div className="relative">
        <textarea value={input} onChange={(e) => handleInputChange(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => !input.trim() && setShowHistory(true)} onBlur={() => setTimeout(() => setShowHistory(false), 150)} placeholder={t("tools.rephrase.inputPlaceholder")} rows={3} maxLength={500} autoComplete="off" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 resize-none transition-colors" />
        <div className="flex justify-end">
          <span className={`text-xs ${input.length > 450 ? (input.length >= 500 ? "text-red-500" : "text-amber-500") : "text-gray-400"}`}>
            {input.length}/500
          </span>
        </div>
        {activePair && <RecentSearches tool="rephrase" pairId={activePair.id} visible={showHistory && !input.trim()} onSelect={(q) => { handleInputChange(q); setShowHistory(false); }} />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(TONE_STYLES).map(([tone, style]) => (
          <button
            key={tone}
            onClick={() => setSelectedTones(prev => {
              const next = new Set(prev);
              if (next.has(tone)) next.delete(tone);
              else next.add(tone);
              return next;
            })}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider transition-all ${
              selectedTones.has(tone) || selectedTones.size === 0
                ? `${style.bg} ${style.text} ring-2 ring-offset-1 ring-amber-400/50`
                : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
            }`}
          >
            {tone}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={handleRephrase} disabled={!input.trim() || loading} className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <><Loader2 size={16} className="animate-spin" />{t("tools.rephrase.rephrasing")}</> : t("tools.rephrase.rephrase")}
        </button>
        {activePair && (
          <button onClick={() => {
            clearToolHistory(activePair.id, "rephrase");
            setStructured(null); setFallback(null); handleInputChange(""); useAppStore.getState().setToolResult("rephrase", null);          }} className="flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-red-500 text-sm font-medium rounded-lg transition-colors" title={t("common.clear")}>
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {!structured && !fallback && !loading && (
        <ExamplePreview loading={trExLoading} onClick={() => { handleInputChange(trEx(REPHRASE_EXAMPLE.sampleInput)); }}>
          <div className="space-y-3">
            {REPHRASE_EXAMPLE.alternatives.map((alt, i) => {
              const ts = TONE_STYLES[alt.tone] || TONE_STYLES.neutral;
              return (
                <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <div className="flex-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${ts.bg} ${ts.text}`}>{alt.tone}</span>
                    <p className="text-sm text-gray-900 dark:text-white leading-relaxed mt-2">{trEx(alt.text)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">{trEx(alt.note)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ExamplePreview>
      )}

      {structured && (() => {
        const displayAlternatives = structured.alternatives.filter(
          alt => selectedTones.size === 0 || selectedTones.has(alt.tone)
        );
        return (
          <div className="space-y-3">
            {displayAlternatives.map((alt, i) => {
              const ts = TONE_STYLES[alt.tone] || TONE_STYLES.neutral;
              return (
                <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${ts.bg} ${ts.text}`}>{alt.tone}</span>
                      <p className="text-sm text-gray-900 dark:text-white leading-relaxed mt-2">
                        {highlightDiff(input, alt.text)}
                      </p>
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
        );
      })()}
      {fallback && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm"><div className="prose prose-sm dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: formatMessage(fallback) }} /></div>}
    </div>
  );
}
