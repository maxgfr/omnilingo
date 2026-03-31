import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Loader2, Plus, Check, Volume2, Sparkles } from "lucide-react";
import { useApp } from "../../store/AppContext";
import * as bridge from "../../lib/bridge";
import { speak } from "../../lib/speech";
import { cachedAskAi } from "../../lib/ai-cache";
import { parseAiJson } from "../../lib/markdown";
import type { Word } from "../../types";

const DAILY_COUNT = 8;
const STORAGE_PREFIX = "omnilingo-daily-words";
const TEXT_STORAGE_PREFIX = "omnilingo-daily-text";

function getStorageKey(prefix: string, pairId: number): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${prefix}-${pairId}-${today}`;
}

interface DailyTextResult {
  text: string;
  translation: string;
}

export default function DailyWordsTool() {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [dailyText, setDailyText] = useState<DailyTextResult | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const loadWords = useCallback(async (forceRefresh = false) => {
    if (!activePair) return;
    setLoading(true);
    const key = getStorageKey(STORAGE_PREFIX, activePair.id);
    if (!forceRefresh) {
      try { const cached = sessionStorage.getItem(key); if (cached) { setWords(JSON.parse(cached)); setLoading(false); return; } } catch {}
    }
    try {
      const results: Word[] = [];
      for (let i = 0; i < DAILY_COUNT; i++) {
        try { const word = await bridge.getRandomWord(activePair.id); if (word && !results.some((w) => w.id === word.id)) results.push(word); } catch { break; }
      }
      setWords(results);
      sessionStorage.setItem(key, JSON.stringify(results));
    } catch {} finally { setLoading(false); }
  }, [activePair]);

  const loadDailyText = useCallback(async () => {
    if (!activePair || !settings) return;
    const key = getStorageKey(TEXT_STORAGE_PREFIX, activePair.id);
    try { const cached = sessionStorage.getItem(key); if (cached) { setDailyText(JSON.parse(cached)); return; } } catch {}
    setTextLoading(true);
    try {
      const level = settings.level || "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const prompt = `Generate a short ${srcName} paragraph (3-5 sentences) for a ${level} level student. Topic: everyday life. Return JSON:
{"text":"paragraph in ${srcName}","translation":"translation in ${tgtName}"}
Natural, realistic text. ONLY valid JSON.`;
      const response = await cachedAskAi("daily-text", "daily", activePair.id, prompt);
      const parsed = parseAiJson<DailyTextResult>(response);
      if (parsed?.text) { setDailyText(parsed); sessionStorage.setItem(key, JSON.stringify(parsed)); }
    } catch {} finally { setTextLoading(false); }
  }, [activePair, settings]);

  useEffect(() => { loadWords(); loadDailyText(); }, [loadWords, loadDailyText]);

  const handleAddToSrs = async (wordId: number) => {
    if (addedIds.has(wordId)) return;
    try { await bridge.addWordToSrs(wordId); setAddedIds((prev) => new Set(prev).add(wordId)); } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Words section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("tools.daily.title")}</h2><p className="text-sm text-gray-500 dark:text-gray-400">{t("tools.daily.subtitle")}</p></div>
          <button onClick={() => loadWords(true)} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50">
            {loading ? <><Loader2 size={16} className="animate-spin" />{t("tools.daily.refreshing")}</> : <><RefreshCw size={16} />{t("tools.daily.refresh")}</>}
          </button>
        </div>
        {words.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {words.map((word) => (
              <div key={word.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">{word.source_word}</span>
                    {word.gender && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${word.gender === "m" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" : word.gender === "f" ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>{word.gender}</span>}
                  </div>
                  <button onClick={() => speak(word.source_word, activePair?.source_lang || "de")} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><Volume2 size={14} className="text-gray-400" /></button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{word.target_word}</p>
                <div className="flex items-center justify-between">
                  {word.level && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium">{word.level}</span>}
                  <button onClick={() => handleAddToSrs(word.id)} disabled={addedIds.has(word.id)} className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${addedIds.has(word.id) ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>
                    {addedIds.has(word.id) ? <Check size={12} /> : <Plus size={12} />}
                    {addedIds.has(word.id) ? t("tools.daily.added") : t("tools.daily.addToSrs")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : !loading ? <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t("common.noResults")}</div> : null}
      </div>

      {/* Daily text section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("tools.daily.textTitle")}</h2>
        </div>
        {textLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
        ) : dailyText ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <p className="text-sm leading-relaxed text-gray-900 dark:text-gray-100 flex-1">{dailyText.text}</p>
              <button onClick={() => speak(dailyText.text, activePair?.source_lang || "de")} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"><Volume2 size={16} className="text-gray-500" /></button>
            </div>
            <button onClick={() => setShowTranslation(!showTranslation)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
              {showTranslation ? t("tools.daily.hideTranslation") : t("tools.daily.showTranslation")}
            </button>
            {showTranslation && <p className="text-sm text-gray-500 dark:text-gray-400 italic border-t border-gray-100 dark:border-gray-700 pt-3">{dailyText.translation}</p>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
