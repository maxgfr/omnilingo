import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Loader2, RefreshCw, Volume2, Check, X, AlertTriangle } from "lucide-react";
import { useApp } from "../../store/AppContext";
import * as bridge from "../../lib/bridge";
import { speak, recordAudio } from "../../lib/speech";
import type { Word } from "../../types";

type RecordState = "idle" | "recording" | "transcribing";

export default function PronunciationTool() {
  const { t } = useTranslation();
  const { activePair } = useApp();
  const [word, setWord] = useState<Word | null>(null);
  const [loading, setLoading] = useState(false);
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isMatch, setIsMatch] = useState<boolean | null>(null);
  const [hasWhisper, setHasWhisper] = useState<boolean | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  // Check if Whisper model is available
  useEffect(() => {
    bridge.getWhisperModels().then((models) => {
      setHasWhisper(models.some((m) => m.downloaded));
    }).catch(() => setHasWhisper(false));
  }, []);

  const loadNewWord = useCallback(async () => {
    if (!activePair) return;
    setLoading(true);
    setTranscript(null);
    setIsMatch(null);
    try {
      const w = await bridge.getRandomWord(activePair.id);
      setWord(w);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [activePair]);

  useEffect(() => { loadNewWord(); }, [loadNewWord]);

  const handleRecord = async () => {
    if (recordState !== "idle" || !word || !activePair) return;
    setTranscript(null);
    setIsMatch(null);
    setRecordState("recording");

    try {
      const samples = await recordAudio(3000);
      setRecordState("transcribing");

      const langCode = activePair.source_lang.split("-")[0];
      const result = await bridge.transcribeAudio(Array.from(samples), langCode);
      const normalized = result.toLowerCase().trim().replace(/[.,!?;:'"]/g, "");
      const expected = word.source_word.toLowerCase().trim().replace(/[.,!?;:'"]/g, "");
      const match = normalized === expected || normalized.includes(expected) || expected.includes(normalized);

      setTranscript(result);
      setIsMatch(match);
      setScore((prev) => ({ correct: prev.correct + (match ? 1 : 0), total: prev.total + 1 }));
    } catch (err) {
      setTranscript(String(err));
      setIsMatch(false);
    } finally {
      setRecordState("idle");
    }
  };

  const handleNext = () => {
    loadNewWord();
  };

  if (hasWhisper === false) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <AlertTriangle size={32} className="text-amber-500" />
        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{t("tools.pronunciation.noModel")}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t("tools.pronunciation.downloadHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score */}
      {score.total > 0 && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">{t("tools.pronunciation.score")}</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{score.correct}/{score.total}</span>
          <span className="text-gray-400">({Math.round((score.correct / score.total) * 100)}%)</span>
        </div>
      )}

      {/* Word card */}
      {word ? (
        <div className="flex flex-col items-center py-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{word.source_word}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{word.target_word}</p>
            {word.gender && (
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                word.gender === "m" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                word.gender === "f" ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400" :
                "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}>{word.gender}</span>
            )}
          </div>

          {/* Listen button */}
          <button
            onClick={() => speak(word.source_word, activePair?.source_lang || "de")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Volume2 size={18} />
            {t("tools.pronunciation.listen")}
          </button>

          {/* Record button */}
          <button
            onClick={handleRecord}
            disabled={recordState !== "idle"}
            className={`flex items-center justify-center w-20 h-20 rounded-full transition-all shadow-lg ${
              recordState === "recording"
                ? "bg-red-500 text-white animate-pulse scale-110"
                : recordState === "transcribing"
                  ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-wait"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105"
            }`}
          >
            {recordState === "transcribing" ? (
              <Loader2 size={28} className="animate-spin" />
            ) : (
              <Mic size={28} />
            )}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {recordState === "recording" ? t("tools.pronunciation.recording") : recordState === "transcribing" ? t("tools.pronunciation.analyzing") : t("tools.pronunciation.tapToRecord")}
          </p>

          {/* Result */}
          {transcript !== null && (
            <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${
              isMatch
                ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
                : "border-rose-300 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800"
            }`}>
              {isMatch ? <Check size={20} className="text-emerald-600 dark:text-emerald-400" /> : <X size={20} className="text-rose-600 dark:text-rose-400" />}
              <div>
                <p className={`text-sm font-medium ${isMatch ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                  {isMatch ? t("tools.pronunciation.correct") : t("tools.pronunciation.tryAgain")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("tools.pronunciation.heard")}: "{transcript}"</p>
              </div>
            </div>
          )}

          {/* Next button */}
          <button
            onClick={handleNext}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <RefreshCw size={16} />
            {t("common.next")}
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">{t("common.noResults")}</div>
      )}
    </div>
  );
}
