import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  GraduationCap, Loader2, Send, Check, X,
  ArrowRight, RotateCcw, Target, Brain, Zap,
  AlertTriangle, TrendingUp, Trophy,
} from "lucide-react";
import { useApp } from "../../store/AppContext";
import * as bridge from "../../lib/bridge";
import { parseAiJson, formatMessage } from "../../lib/markdown";
import {
  getStudentProfile, buildSessionPrompt, buildEvaluationPrompt, buildNextExercisePrompt,
  type StudentProfile, type MasteryExercise, type EvaluationResult, type SessionRound,
} from "../../lib/mastery";

type Phase = "idle" | "loading" | "exercise" | "evaluating" | "feedback" | "summary";
type Focus = "vocabulary" | "grammar" | "mixed";

const MAX_EXERCISES = 10;

const DIFFICULTY_STYLES: Record<string, string> = {
  review: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  frontier: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  stretch: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
};

const MASTERY_STYLES: Record<string, { style: string; icon: typeof Check }> = {
  not_yet: { style: "text-rose-600 dark:text-rose-400", icon: X },
  progressing: { style: "text-amber-600 dark:text-amber-400", icon: TrendingUp },
  mastered: { style: "text-emerald-600 dark:text-emerald-400", icon: Check },
};

export default function MasteryTool() {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();

  const [phase, setPhase] = useState<Phase>("idle");
  const [focus, setFocus] = useState<Focus>("mixed");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [currentExercise, setCurrentExercise] = useState<MasteryExercise | null>(null);
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResult | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionRound[]>([]);
  const [misconceptions, setMisconceptions] = useState<string[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load profile on mount
  useEffect(() => {
    if (activePair) {
      getStudentProfile(activePair.id).then(setProfile).catch(() => {});
    }
  }, [activePair]);

  const correctCount = sessionHistory.filter((r) => r.evaluation.correct).length;
  const accuracy = sessionHistory.length > 0 ? Math.round((correctCount / sessionHistory.length) * 100) : 0;

  // ── Start Session ────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    if (!activePair || !settings) return;
    setPhase("loading");
    setError(null);
    setSessionHistory([]);
    setMisconceptions([]);

    try {
      const p = await getStudentProfile(activePair.id);
      setProfile(p);
      const prompt = buildSessionPrompt(p, activePair, settings.level || "A2", focus);
      const response = await bridge.askAi(prompt);
      const exercise = parseAiJson<MasteryExercise>(response);
      if (!exercise?.type || !exercise?.question) {
        throw new Error("Invalid exercise format");
      }
      setCurrentExercise(exercise);
      setCurrentEvaluation(null);
      setUserAnswer("");
      setSelectedOption(null);
      setPhase("exercise");
    } catch (err) {
      setError(String(err));
      setPhase("idle");
    }
  }, [activePair, settings, focus]);

  // ── Submit Answer ────────────────────────────────────────────────

  const submitAnswer = useCallback(async () => {
    if (!activePair || !settings || !profile || !currentExercise) return;
    const answer = currentExercise.type === "mcq" && selectedOption !== null
      ? (currentExercise.options?.[selectedOption] ?? "")
      : userAnswer.trim();
    if (!answer) return;

    setPhase("evaluating");
    setError(null);

    try {
      const prompt = buildEvaluationPrompt(
        profile, activePair, settings.level || "A2",
        currentExercise, answer, sessionHistory,
      );
      const response = await bridge.askAi(prompt);
      const evaluation = parseAiJson<EvaluationResult>(response);
      if (!evaluation || typeof evaluation.correct !== "boolean") {
        throw new Error("Invalid evaluation format");
      }
      setCurrentEvaluation(evaluation);

      // Track misconception
      if (evaluation.misconception) {
        setMisconceptions((prev) => [...new Set([...prev, evaluation.misconception!])]);
      }

      // Log error for future sessions
      if (!evaluation.correct && activePair) {
        bridge.logError(
          activePair.id,
          currentExercise.targetSkill,
          currentExercise.question.slice(0, 60),
          answer,
          currentExercise.correctAnswer,
        ).catch(() => {});
      }

      setSessionHistory((prev) => [...prev, { exercise: currentExercise, userAnswer: answer, evaluation }]);
      setPhase("feedback");
    } catch (err) {
      setError(String(err));
      setPhase("exercise");
    }
  }, [activePair, settings, profile, currentExercise, userAnswer, selectedOption, sessionHistory]);

  // ── Next Exercise ────────────────────────────────────────────────

  const nextExercise = useCallback(async () => {
    if (!activePair || !settings || !profile) return;
    if (sessionHistory.length >= MAX_EXERCISES) {
      setPhase("summary");
      return;
    }

    setPhase("loading");
    setError(null);

    try {
      const prompt = buildNextExercisePrompt(
        profile, activePair, settings.level || "A2",
        sessionHistory, misconceptions, focus,
      );
      const response = await bridge.askAi(prompt);
      const exercise = parseAiJson<MasteryExercise>(response);
      if (!exercise?.type || !exercise?.question) {
        throw new Error("Invalid exercise format");
      }
      setCurrentExercise(exercise);
      setCurrentEvaluation(null);
      setUserAnswer("");
      setSelectedOption(null);
      setPhase("exercise");
    } catch (err) {
      setError(String(err));
      setPhase("feedback");
    }
  }, [activePair, settings, profile, sessionHistory, misconceptions, focus]);

  // ── End Session ──────────────────────────────────────────────────

  const endSession = useCallback(() => {
    if (activePair && sessionHistory.length > 0) {
      bridge.logSession(activePair.id, "mastery", {
        exercises: sessionHistory.length,
        correct: correctCount,
        accuracy,
        misconceptions,
        focus,
      }).catch(() => {});
    }
    setPhase("summary");
  }, [activePair, sessionHistory, correctCount, accuracy, misconceptions, focus]);

  const resetSession = () => {
    setPhase("idle");
    setCurrentExercise(null);
    setCurrentEvaluation(null);
    setSessionHistory([]);
    setMisconceptions([]);
    setUserAnswer("");
    setSelectedOption(null);
    setError(null);
  };

  if (!activePair) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">{t("dashboard.noActivePair")}</div>;
  }

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-400">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── IDLE ─────────────────────────────────────────────────── */}
      {phase === "idle" && (
        <div className="space-y-4">
          {/* Student snapshot */}
          {profile && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t("tools.mastery.dueCards"), value: profile.srsStats.due_count, icon: Target },
                { label: t("tools.mastery.accuracy"), value: `${profile.overviewStats.accuracy}%`, icon: TrendingUp },
                { label: t("tools.mastery.wordsLearned"), value: profile.overviewStats.total_learned, icon: Brain },
                { label: t("tools.mastery.errors"), value: profile.frequentErrors.length, icon: AlertTriangle },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <Icon size={16} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Weak areas preview */}
          {profile && profile.frequentErrors.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                {t("tools.mastery.weakAreas")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profile.frequentErrors.slice(0, 8).map((err) => (
                  <span key={err.word} className="px-2 py-1 text-xs rounded-full bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-300">
                    {err.word} ({err.count}x)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Focus selector */}
          <div className="flex gap-2">
            {(["mixed", "vocabulary", "grammar"] as Focus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFocus(f)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                  focus === f
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                }`}
              >
                {t(`tools.mastery.focus.${f}`)}
              </button>
            ))}
          </div>

          {/* Start button */}
          <button
            onClick={startSession}
            className="flex items-center gap-3 w-full px-6 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-base transition-colors shadow-sm"
          >
            <GraduationCap size={22} />
            {t("tools.mastery.startSession")}
          </button>
        </div>
      )}

      {/* ── LOADING ──────────────────────────────────────────────── */}
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={28} className="animate-spin text-amber-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("tools.mastery.generating")}</p>
        </div>
      )}

      {/* ── EXERCISE ─────────────────────────────────────────────── */}
      {phase === "exercise" && currentExercise && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${((sessionHistory.length + 1) / MAX_EXERCISES) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {sessionHistory.length + 1}/{MAX_EXERCISES}
            </span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${DIFFICULTY_STYLES[currentExercise.difficulty] || DIFFICULTY_STYLES.frontier}`}>
              {t(`tools.mastery.difficulty.${currentExercise.difficulty}`)}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {currentExercise.targetSkill}
            </span>
          </div>

          {/* Question */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
              {currentExercise.question}
            </p>
            {currentExercise.hint && (
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">{currentExercise.hint}</p>
            )}
          </div>

          {/* Answer input based on type */}
          {currentExercise.type === "mcq" && currentExercise.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentExercise.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedOption(i)}
                  className={`text-left px-4 py-3 rounded-lg border-2 text-sm transition-all ${
                    selectedOption === i
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentExercise.type !== "mcq" && (
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitAnswer();
                }
              }}
              placeholder={t(`tools.mastery.placeholder.${currentExercise.type}`)}
              rows={currentExercise.type === "translate" ? 3 : 2}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none transition-colors"
            />
          )}

          {/* Submit button */}
          <button
            onClick={submitAnswer}
            disabled={currentExercise.type === "mcq" ? selectedOption === null : !userAnswer.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
            {t("tools.mastery.submitAnswer")}
          </button>
        </div>
      )}

      {/* ── EVALUATING ───────────────────────────────────────────── */}
      {phase === "evaluating" && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={28} className="animate-spin text-amber-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("tools.mastery.evaluating")}</p>
        </div>
      )}

      {/* ── FEEDBACK ─────────────────────────────────────────────── */}
      {phase === "feedback" && currentExercise && currentEvaluation && (
        <div className="space-y-4">
          {/* Correct/Incorrect banner */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border-2 ${
            currentEvaluation.correct
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
              : "border-rose-500 bg-rose-50 dark:bg-rose-900/20"
          }`}>
            {currentEvaluation.correct
              ? <Check size={20} className="text-emerald-600 dark:text-emerald-400" />
              : <X size={20} className="text-rose-600 dark:text-rose-400" />}
            <div className="flex-1">
              <p className={`font-semibold text-sm ${currentEvaluation.correct ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                {currentEvaluation.correct ? t("common.correct") : t("common.incorrect")}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Score: {currentEvaluation.score}/100
              </p>
            </div>
            {/* Mastery signal */}
            {(() => {
              const ms = MASTERY_STYLES[currentEvaluation.masterySignal] || MASTERY_STYLES.not_yet;
              const MsIcon = ms.icon;
              return (
                <span className={`flex items-center gap-1 text-xs font-medium ${ms.style}`}>
                  <MsIcon size={14} />
                  {t(`tools.mastery.signal.${currentEvaluation.masterySignal}`)}
                </span>
              );
            })()}
          </div>

          {/* Correct answer if wrong */}
          {!currentEvaluation.correct && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                {t("common.correctAnswer")}
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{currentExercise.correctAnswer}</p>
            </div>
          )}

          {/* AI feedback */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {t("tools.mastery.feedbackLabel")}
            </p>
            <div
              className="text-sm leading-relaxed text-gray-700 dark:text-gray-300"
              dangerouslySetInnerHTML={{ __html: formatMessage(currentEvaluation.feedback) }}
            />
          </div>

          {/* Misconception alert */}
          {currentEvaluation.misconception && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <Brain size={16} className="text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                  {t("tools.mastery.misconception")}
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300">{currentEvaluation.misconception}</p>
              </div>
            </div>
          )}

          {/* Running score */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{t("tools.mastery.sessionScore")}: {correctCount}/{sessionHistory.length}</span>
            <span>{t("tools.mastery.accuracy")}: {accuracy}%</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {sessionHistory.length < MAX_EXERCISES && (
              <button
                onClick={nextExercise}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <ArrowRight size={16} />
                {t("tools.mastery.nextExercise")}
              </button>
            )}
            <button
              onClick={endSession}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {sessionHistory.length >= MAX_EXERCISES ? t("tools.mastery.viewSummary") : t("tools.mastery.endSession")}
            </button>
          </div>
        </div>
      )}

      {/* ── SUMMARY ──────────────────────────────────────────────── */}
      {phase === "summary" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Trophy size={24} className="text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("tools.mastery.summary.title")}</h2>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t("tools.mastery.summary.exercises"), value: sessionHistory.length },
              { label: t("tools.mastery.summary.correct"), value: correctCount },
              { label: t("tools.mastery.summary.accuracy"), value: `${accuracy}%` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Skills breakdown */}
          {sessionHistory.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t("tools.mastery.summary.skills")}
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {sessionHistory.map((round, i) => {
                  const ms = MASTERY_STYLES[round.evaluation.masterySignal] || MASTERY_STYLES.not_yet;
                  const MsIcon = ms.icon;
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                      {round.evaluation.correct
                        ? <Check size={14} className="text-emerald-500" />
                        : <X size={14} className="text-rose-500" />}
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{round.exercise.targetSkill}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_STYLES[round.exercise.difficulty]}`}>
                        {round.exercise.difficulty}
                      </span>
                      <MsIcon size={14} className={ms.style} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Misconceptions */}
          {misconceptions.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                {t("tools.mastery.summary.misconceptions")} ({misconceptions.length})
              </p>
              {misconceptions.map((m, i) => (
                <p key={i} className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <Zap size={12} className="mt-1 flex-shrink-0" /> {m}
                </p>
              ))}
            </div>
          )}

          {/* Restart */}
          <button
            onClick={resetSession}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <RotateCcw size={16} />
            {t("tools.mastery.newSession")}
          </button>
        </div>
      )}
    </div>
  );
}
