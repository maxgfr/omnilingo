import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2, Volume2, Send, Check, X, RotateCcw,
  Ear, Trophy, ArrowRight, Gauge,
} from "lucide-react";
import { useApp } from "../../store/AppContext";
import * as bridge from "../../lib/bridge";
import { speak, getSourceLang } from "../../lib/speech";
import { parseAiJson, formatMessage } from "../../lib/markdown";
import { getPromptContext } from "../../lib/ai-cache";
import type { SrsCard } from "../../types";

type Phase = "idle" | "loading" | "listening" | "answered" | "summary";
type Speed = "slow" | "normal";

interface DictationRound {
  sentence: string;
  translation: string;
  userAnswer: string;
  correct: boolean;
  feedback: string;
  difficulty: string;
}

interface DictationSentence {
  sentence: string;
  translation: string;
  difficulty: string;
  targetWords: string[];
}

const MAX_ROUNDS = 8;

export default function DictationTool() {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();

  const [phase, setPhase] = useState<Phase>("idle");
  const [speed, setSpeed] = useState<Speed>("normal");
  const [currentSentence, setCurrentSentence] = useState<DictationSentence | null>(null);
  const [userInput, setUserInput] = useState("");
  const [rounds, setRounds] = useState<DictationRound[]>([]);
  const [feedback, setFeedback] = useState<string>("");
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const correctCount = rounds.filter((r) => r.correct).length;
  const accuracy = rounds.length > 0 ? Math.round((correctCount / rounds.length) * 100) : 0;

  const generateSentence = useCallback(async () => {
    if (!activePair || !settings) return;
    setLoading(true);
    setPhase("loading");

    try {
      const level = settings.level || "A2";
      const srcName = activePair.source_name;
      const tgtName = activePair.target_name;
      const enriched = await getPromptContext(activePair.id);

      // Get struggling words for targeted sentences
      let weakWords = "";
      try {
        const dueCards = await bridge.getDueCards(activePair.id);
        const struggling = [...dueCards]
          .sort((a: SrsCard, b: SrsCard) => a.ease_factor - b.ease_factor)
          .slice(0, 5)
          .map((c: SrsCard) => c.source_word);
        if (struggling.length > 0) {
          weakWords = `\nTry to include one of these words the student struggles with: ${struggling.join(", ")}`;
        }
      } catch { /* ignore */ }

      const previousSentences = rounds.map((r) => r.sentence).join("; ");

      const prompt = `Generate a ${srcName} sentence for a dictation exercise at CEFR level ${level}.
The student will hear the sentence and type what they hear.

Rules:
- The sentence should be natural and realistic (3-12 words depending on level)
- For A1-A2: simple present tense, common vocabulary, short sentences
- For B1-B2: past/future tenses, subordinate clauses, richer vocabulary
- For C1-C2: complex structures, idioms, nuanced vocabulary
- DO NOT repeat these previous sentences: ${previousSentences || "none yet"}
${weakWords}
${enriched}

Return ONLY valid JSON:
{"sentence":"the ${srcName} sentence","translation":"translation in ${tgtName}","difficulty":"A1|A2|B1|B2","targetWords":["key","words","to","listen","for"]}`;

      const response = await bridge.askAi(prompt);
      const parsed = parseAiJson<DictationSentence>(response);
      if (!parsed?.sentence) throw new Error("Invalid sentence format");

      setCurrentSentence(parsed);
      setUserInput("");
      setPlayCount(0);
      setPhase("listening");

      // Auto-play the sentence
      setTimeout(() => {
        const lang = getSourceLang(activePair.source_lang || "de");
        speak(parsed.sentence, lang);
        setPlayCount(1);
      }, 500);
    } catch (err) {
      console.error(err);
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  }, [activePair, settings, rounds]);

  const playSentence = useCallback(() => {
    if (!currentSentence || !activePair) return;
    const lang = getSourceLang(activePair.source_lang || "de");
    const rate = speed === "slow" ? 0.6 : 0.85;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentSentence.sentence);
    utterance.lang = lang;
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
    setPlayCount((p) => p + 1);
  }, [currentSentence, activePair, speed]);

  const submitAnswer = useCallback(async () => {
    if (!currentSentence || !userInput.trim() || !activePair || !settings) return;
    setLoading(true);

    try {
      const prompt = `Evaluate this dictation answer.

Original sentence: "${currentSentence.sentence}"
Student's answer: "${userInput.trim()}"
Language: ${activePair.source_name}

Rules:
- Be generous with minor accent/capitalization differences
- Count each word-level error (missing, extra, or wrong word)
- Give specific feedback about what was missed or wrong in ${activePair.target_name}

Return ONLY valid JSON:
{"correct":true/false,"feedback":"explanation in ${activePair.target_name}"}`;

      const response = await bridge.askAi(prompt);
      const evaluation = parseAiJson<{ correct: boolean; feedback: string }>(response);

      const correct = evaluation?.correct ?? false;
      const fb = evaluation?.feedback ?? "";

      setIsCorrect(correct);
      setFeedback(fb);

      const round: DictationRound = {
        sentence: currentSentence.sentence,
        translation: currentSentence.translation,
        userAnswer: userInput.trim(),
        correct,
        feedback: fb,
        difficulty: currentSentence.difficulty,
      };
      setRounds((prev) => [...prev, round]);

      // Log errors
      if (!correct) {
        bridge.logError(
          activePair.id, "dictation",
          currentSentence.sentence.slice(0, 60),
          userInput.trim(), currentSentence.sentence,
        ).catch(() => {});
      }

      setPhase("answered");
    } catch {
      setPhase("listening");
    } finally {
      setLoading(false);
    }
  }, [currentSentence, userInput, activePair, settings]);

  const nextRound = () => {
    if (rounds.length >= MAX_ROUNDS) {
      if (activePair) {
        bridge.logSession(activePair.id, "dictation", {
          rounds: rounds.length, correct: correctCount + (isCorrect ? 1 : 0),
          accuracy: Math.round(((correctCount + (isCorrect ? 1 : 0)) / (rounds.length)) * 100),
        }).catch(() => {});
      }
      setPhase("summary");
    } else {
      generateSentence();
    }
  };

  const resetSession = () => {
    setPhase("idle");
    setRounds([]);
    setCurrentSentence(null);
    setUserInput("");
    setFeedback("");
  };

  return (
    <div className="space-y-4">
      {/* ── IDLE ──── */}
      {phase === "idle" && (
        <div className="space-y-4">
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 mb-4">
              <Ear size={32} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t("tools.dictation.title")}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">{t("tools.dictation.subtitle")}</p>
          </div>

          {/* Speed toggle */}
          <div className="flex justify-center gap-2">
            {(["normal", "slow"] as Speed[]).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                  speed === s
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                <Gauge size={14} />
                {t(`tools.dictation.speed.${s}`)}
              </button>
            ))}
          </div>

          <button
            onClick={generateSentence}
            className="flex items-center gap-3 w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-base transition-colors shadow-sm justify-center"
          >
            <Ear size={22} />
            {t("tools.dictation.start")}
          </button>
        </div>
      )}

      {/* ── LOADING ──── */}
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("tools.dictation.generating")}</p>
        </div>
      )}

      {/* ── LISTENING ──── */}
      {phase === "listening" && currentSentence && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${((rounds.length + 1) / MAX_ROUNDS) * 100}%` }} />
            </div>
            <span className="text-xs font-medium text-gray-500">{rounds.length + 1}/{MAX_ROUNDS}</span>
          </div>

          {/* Play button */}
          <div className="flex flex-col items-center gap-4 py-6">
            <button
              onClick={playSentence}
              className="w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              <Volume2 size={32} />
            </button>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("tools.dictation.listenAndType")}
              </p>
              <span className="text-xs text-gray-400">({playCount}x)</span>
            </div>
            {/* Speed toggle inline */}
            <button
              onClick={() => setSpeed(speed === "normal" ? "slow" : "normal")}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Gauge size={12} />
              {speed === "normal" ? t("tools.dictation.speed.slow") : t("tools.dictation.speed.normal")}
            </button>
          </div>

          {/* Input */}
          <textarea
            ref={inputRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitAnswer();
              }
            }}
            placeholder={t("tools.dictation.typePlaceholder")}
            rows={2}
            autoFocus
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />

          <button
            onClick={submitAnswer}
            disabled={!userInput.trim() || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {t("tools.dictation.submitAnswer")}
          </button>
        </div>
      )}

      {/* ── ANSWERED ──── */}
      {phase === "answered" && currentSentence && (
        <div className="space-y-4">
          {/* Result banner */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border-2 ${
            isCorrect
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
              : "border-rose-500 bg-rose-50 dark:bg-rose-900/20"
          }`}>
            {isCorrect ? <Check size={20} className="text-emerald-600" /> : <X size={20} className="text-rose-600" />}
            <p className={`font-semibold text-sm ${isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {isCorrect ? t("common.correct") : t("common.incorrect")}
            </p>
          </div>

          {/* Original sentence */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("tools.dictation.originalSentence")}</p>
              <button onClick={playSentence} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <Volume2 size={14} className="text-gray-400" />
              </button>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{currentSentence.sentence}</p>
            <p className="text-xs text-gray-500 italic">{currentSentence.translation}</p>
          </div>

          {/* User's answer if wrong */}
          {!isCorrect && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/10 p-4">
              <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider mb-1">{t("tools.dictation.yourAnswer")}</p>
              <p className="text-sm text-rose-700 dark:text-rose-400">{userInput}</p>
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t("tools.mastery.feedbackLabel")}</p>
              <div className="text-sm text-gray-700 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: formatMessage(feedback) }} />
            </div>
          )}

          {/* Score */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{t("tools.mastery.sessionScore")}: {correctCount + (isCorrect ? 1 : 0)}/{rounds.length}</span>
          </div>

          {/* Next */}
          <button
            onClick={nextRound}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <ArrowRight size={16} />
            {rounds.length >= MAX_ROUNDS ? t("tools.dictation.viewResults") : t("tools.mastery.nextExercise")}
          </button>
        </div>
      )}

      {/* ── SUMMARY ──── */}
      {phase === "summary" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Trophy size={24} className="text-indigo-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("tools.dictation.results")}</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t("tools.mastery.summary.exercises"), value: rounds.length },
              { label: t("tools.mastery.summary.correct"), value: correctCount },
              { label: t("tools.mastery.summary.accuracy"), value: `${accuracy}%` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Round details */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {rounds.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                  {r.correct ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-rose-500" />}
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{r.sentence}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{r.difficulty}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={resetSession}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <RotateCcw size={16} />
            {t("tools.dictation.newSession")}
          </button>
        </div>
      )}
    </div>
  );
}
