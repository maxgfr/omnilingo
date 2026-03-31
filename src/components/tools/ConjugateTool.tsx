import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, Loader2, Database, Sparkles } from "lucide-react";
import { useApp } from "../../store/AppContext";
import * as bridge from "../../lib/bridge";
import { cachedAskAi, addToHistory, getPromptContext } from "../../lib/ai-cache";
import { formatMessage } from "../../lib/markdown";
import type { Verb } from "../../types";

const TENSE_LABELS: Record<string, string> = {
  prasens: "Präsens", prateritum: "Präteritum", perfekt: "Perfekt",
  futur1: "Futur I", konjunktiv2: "Konjunktiv II", imperativ: "Imperativ",
  present: "Present", past: "Past", future: "Future",
  conditional: "Conditional", subjunctive: "Subjunctive", imperative: "Imperative",
};
const PERSON_ORDER = ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"];
const IMPERATIVE_ORDER = ["du", "ihr", "Sie"];

interface ToolProps { onWordClick?: (word: string) => void; initialWord?: string; }

export default function ConjugateTool({ initialWord }: ToolProps) {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();
  const [input, setInput] = useState(initialWord || "");
  const [localVerb, setLocalVerb] = useState<Verb | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"dict" | "ai" | null>(null);

  const handleLookup = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    setLoading(true); setLocalVerb(null); setAiResult(null); setSource(null);
    try {
      const verbs = await bridge.getVerbs(activePair.id, input.trim());
      const match = verbs.find((v) => v.infinitive.toLowerCase() === input.trim().toLowerCase()) || verbs[0];
      if (match && Object.keys(match.conjugations).length > 0) {
        setLocalVerb(match); setSource("dict");
      } else {
        const level = settings?.level || "A2";
        const srcName = activePair.source_name;
        const tgtName = activePair.target_name;
        const enriched = await getPromptContext(activePair.id);
        const prompt = `Full conjugation for ${srcName} verb "${input.trim()}". Level: ${level}.
All major tenses, all persons. Include translation in ${tgtName}, regular/irregular, example sentence.
Markdown headings per tense, table/list for conjugations.
${enriched}`;
        const response = await cachedAskAi("conjugate", input.trim(), activePair.id, prompt);
        setAiResult(response); setSource("ai");
      }
      addToHistory(activePair.id, "conjugate", input.trim());
    } catch (err) { setAiResult(`Error: ${err}`); setSource("ai"); }
    finally { setLoading(false); }
  }, [input, loading, activePair, settings]);

  useEffect(() => { if (initialWord) handleLookup(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); handleLookup(); } };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("tools.conjugate.inputPlaceholder")} className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors" />
        </div>
        <button onClick={handleLookup} disabled={!input.trim() || loading} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <><Loader2 size={16} className="animate-spin" />{t("tools.conjugate.lookingUp")}</> : t("tools.conjugate.lookup")}
        </button>
      </div>

      {source && (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${source === "dict" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"}`}>
          {source === "dict" ? <Database size={12} /> : <Sparkles size={12} />}
          {source === "dict" ? t("tools.conjugate.fromDictionary") : t("tools.conjugate.fromAi")}
        </span>
      )}

      {localVerb && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{localVerb.infinitive}</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">→ {localVerb.translation}</span>
            {localVerb.level && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{localVerb.level}</span>}
            {localVerb.verb_type && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{localVerb.verb_type}</span>}
            {localVerb.auxiliary && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{localVerb.auxiliary}</span>}
            {localVerb.is_separable && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">{t("conjugation.separable")}</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(localVerb.conjugations).map(([tense, forms]) => {
              const personList = tense === "imperativ" ? IMPERATIVE_ORDER : PERSON_ORDER;
              return (
                <div key={tense} className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
                  <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2">{TENSE_LABELS[tense] || tense}</h3>
                  <div className="space-y-1">
                    {personList.map((person) => forms[person] ? (
                      <div key={person} className="flex gap-3 text-sm"><span className="w-20 text-gray-500 dark:text-gray-400 text-right flex-shrink-0">{person}</span><span className="text-gray-900 dark:text-white font-medium">{forms[person]}</span></div>
                    ) : null)}
                  </div>
                </div>
              );
            })}
          </div>
          {localVerb.examples && localVerb.examples.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t("grammar.examples")}</h3>
              <div className="space-y-2">{localVerb.examples.slice(0, 3).map((ex, i) => (<div key={i} className="text-sm"><p className="text-gray-900 dark:text-white">{ex.de}</p><p className="text-gray-500 dark:text-gray-400 italic">{ex.fr}</p></div>))}</div>
            </div>
          )}
        </div>
      )}

      {aiResult && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-gray-900 dark:text-gray-100" dangerouslySetInnerHTML={{ __html: formatMessage(aiResult) }} />
        </div>
      )}
    </div>
  );
}
