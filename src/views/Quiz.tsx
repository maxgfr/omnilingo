import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Zap,
  Check,
  X,
  RotateCcw,
  Trophy,
  ArrowRight,
  Play,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import ProgressBar from "../components/ProgressBar";
import type { Word, Verb } from "../types";

interface QuizQuestion {
  type: "vocab" | "reverse" | "conjugation";
  question: string;
  answer: string;
  options?: string[];
  correctIndex?: number;
}

type Phase = "setup" | "playing" | "feedback" | "completed";

const QUESTION_COUNTS = [10, 15, 20];

export default function Quiz() {
  const { t } = useTranslation();
  const { activePair } = useApp();

  const [phase, setPhase] = useState<Phase>("setup");
  const [questionCount, setQuestionCount] = useState(15);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // Shuffle helper
  function shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // Build quiz questions from words and verbs
  const generateQuestions = useCallback(
    (words: Word[], verbs: Verb[], count: number): QuizQuestion[] => {
      const pool: QuizQuestion[] = [];

      // Build vocab MCQ questions (source -> target)
      if (words.length >= 4) {
        for (const word of words) {
          const wrongPool = words.filter((w) => w.id !== word.id);
          const wrongOptions = shuffle(wrongPool)
            .slice(0, 3)
            .map((w) => w.target_word);
          const allOptions = shuffle([word.target_word, ...wrongOptions]);
          const correctIndex = allOptions.indexOf(word.target_word);

          pool.push({
            type: "vocab",
            question: word.source_word,
            answer: word.target_word,
            options: allOptions,
            correctIndex,
          });
        }
      }

      // Build reverse vocab MCQ questions (target -> source)
      if (words.length >= 4) {
        for (const word of words) {
          const wrongPool = words.filter((w) => w.id !== word.id);
          const wrongOptions = shuffle(wrongPool)
            .slice(0, 3)
            .map((w) => w.source_word);
          const allOptions = shuffle([word.source_word, ...wrongOptions]);
          const correctIndex = allOptions.indexOf(word.source_word);

          pool.push({
            type: "reverse",
            question: word.target_word,
            answer: word.source_word,
            options: allOptions,
            correctIndex,
          });
        }
      }

      // Build conjugation questions (text input) -- dynamic from verb data
      for (const verb of verbs) {
        const availableTenses = Object.keys(verb.conjugations).filter(
          (k) =>
            verb.conjugations[k] &&
            Object.keys(verb.conjugations[k]).length > 0,
        );
        for (const tense of availableTenses) {
          const conjugation = verb.conjugations[tense];
          const availablePersons = Object.keys(conjugation).filter(
            (p) => conjugation[p] && conjugation[p].trim() !== "",
          );
          if (availablePersons.length === 0) continue;

          const person =
            availablePersons[
              Math.floor(Math.random() * availablePersons.length)
            ];
          const answer = conjugation[person];
          const tenseLabel = tense.charAt(0).toUpperCase() + tense.slice(1).replace(/_/g, " ");

          pool.push({
            type: "conjugation",
            question: `${verb.infinitive} (${tenseLabel}, ${person})`,
            answer,
          });
        }
      }

      // Shuffle and pick requested count
      return shuffle(pool).slice(0, count);
    },
    [t],
  );

  const startQuiz = useCallback(async () => {
    if (!activePair) return;
    setLoading(true);

    try {
      const [words, verbs] = await Promise.all([
        bridge.getWords(activePair.id, undefined, 200),
        bridge.getVerbs(activePair.id),
      ]);

      const generated = generateQuestions(words, verbs, questionCount);

      if (generated.length === 0) {
        setLoading(false);
        return;
      }

      setQuestions(generated);
      setCurrentIndex(0);
      setScore(0);
      setSelectedOption(null);
      setTextAnswer("");
      setIsCorrect(null);
      setPhase("playing");
    } catch (err) {
      console.error("Failed to generate quiz:", err);
    } finally {
      setLoading(false);
    }
  }, [activePair, questionCount, generateQuestions]);

  const currentQuestion = questions[currentIndex] ?? null;

  // Handle MCQ selection
  function handleOptionSelect(index: number) {
    if (isCorrect !== null) return; // already answered
    setSelectedOption(index);
    const correct = index === currentQuestion?.correctIndex;
    setIsCorrect(correct);
    if (correct) setScore((s) => s + 1);
    setPhase("feedback");
  }

  // Handle text answer submission
  function handleTextSubmit() {
    if (!currentQuestion || isCorrect !== null) return;
    const userAnswer = textAnswer.trim().toLowerCase();
    const expectedAnswer = currentQuestion.answer.trim().toLowerCase();
    const correct = userAnswer === expectedAnswer;
    setIsCorrect(correct);
    if (correct) setScore((s) => s + 1);
    setPhase("feedback");
  }

  // Advance to next question or completion
  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      setPhase("completed");
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setTextAnswer("");
      setIsCorrect(null);
      setPhase("playing");
    }
  }

  // Keyboard handling for text input and navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (phase === "feedback" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        handleNext();
      }
    },
    [phase, currentIndex, questions.length],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // --- Grade calculation ---
  function getGrade(pct: number): {
    label: string;
    color: string;
    bg: string;
  } {
    if (pct >= 90) {
      return {
        label: t("quiz.excellent"),
        color: "text-emerald-500",
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
      };
    }
    if (pct >= 70) {
      return {
        label: t("quiz.good"),
        color: "text-blue-500",
        bg: "bg-blue-100 dark:bg-blue-900/30",
      };
    }
    return {
      label: t("quiz.keepPracticing"),
      color: "text-amber-500",
      bg: "bg-amber-100 dark:bg-amber-900/30",
    };
  }

  // --- Setup screen ---
  if (phase === "setup") {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
            <Zap size={40} className="text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("quiz.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {t("quiz.subtitle")}
          </p>
        </div>

        {/* Question count selection */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t("quiz.questionCount")}
          </label>
          <div className="flex gap-3">
            {QUESTION_COUNTS.map((count) => (
              <button
                key={count}
                onClick={() => setQuestionCount(count)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  questionCount === count
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500"
                }`}
              >
                {count} {t("quiz.questions")}
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={startQuiz}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-lg font-semibold transition-colors shadow-sm"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Play size={22} />
              {t("quiz.start")}
            </>
          )}
        </button>
      </div>
    );
  }

  // --- Completed screen ---
  if (phase === "completed") {
    const total = questions.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    const grade = getGrade(pct);

    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${grade.bg}`}
          >
            <Trophy size={40} className={grade.color} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {t("quiz.completed")}
          </h2>
          <p className={`text-lg font-semibold ${grade.color}`}>
            {grade.label}
          </p>
        </div>

        {/* Score grid */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {score}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t("quiz.correct")}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {total}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t("quiz.total")}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className={`text-2xl font-bold ${grade.color}`}>{pct}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t("quiz.score")}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setPhase("setup");
              setQuestions([]);
              setCurrentIndex(0);
              setScore(0);
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors"
          >
            <RotateCcw size={18} />
            {t("quiz.tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  // --- Playing / Feedback screen ---
  if (!currentQuestion) return null;

  const isMCQ =
    currentQuestion.type === "vocab" || currentQuestion.type === "reverse";

  const questionLabel =
    currentQuestion.type === "vocab"
      ? t("quiz.translateWord")
      : currentQuestion.type === "reverse"
        ? t("quiz.whatIsTheWord")
        : t("quiz.conjugate");

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      {/* Header with progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {t("quiz.title")}
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
        <ProgressBar
          value={currentIndex + (phase === "feedback" ? 1 : 0)}
          max={questions.length}
          color="bg-amber-500"
        />
      </div>

      {/* Score indicator */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <Check size={14} className="text-emerald-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {score}
          </span>
        </div>
      </div>

      {/* Question type badge */}
      <div className="mb-3">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
            currentQuestion.type === "conjugation"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
              : currentQuestion.type === "reverse"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          }`}
        >
          {questionLabel}
        </span>
      </div>

      {/* Question card */}
      <div className="rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 mb-6 text-center shadow-sm">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {currentQuestion.question}
        </p>
      </div>

      {/* Answer area */}
      {isMCQ && currentQuestion.options ? (
        <div className="space-y-3">
          {currentQuestion.options.map((option, i) => {
            let optionStyle =
              "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-amber-400 dark:hover:border-amber-500";

            if (phase === "feedback") {
              if (i === currentQuestion.correctIndex) {
                optionStyle =
                  "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400";
              } else if (i === selectedOption && !isCorrect) {
                optionStyle =
                  "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400";
              } else {
                optionStyle =
                  "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500";
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleOptionSelect(i)}
                disabled={phase === "feedback"}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left text-sm font-medium transition-all ${optionStyle}`}
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold opacity-60">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{option}</span>
                {phase === "feedback" && i === currentQuestion.correctIndex && (
                  <Check size={18} className="text-emerald-500 flex-shrink-0" />
                )}
                {phase === "feedback" &&
                  i === selectedOption &&
                  !isCorrect && (
                    <X size={18} className="text-rose-500 flex-shrink-0" />
                  )}
              </button>
            );
          })}
        </div>
      ) : (
        // Conjugation text input
        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && phase === "playing") {
                  e.preventDefault();
                  handleTextSubmit();
                }
              }}
              disabled={phase === "feedback"}
              placeholder={t("quiz.typeAnswer")}
              className={`w-full px-4 py-3.5 rounded-xl border-2 text-sm font-medium outline-none transition-all ${
                phase === "feedback"
                  ? isCorrect
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    : "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              } placeholder:text-gray-300 dark:placeholder:text-gray-600`}
              autoFocus
            />
            {phase === "feedback" && isCorrect && (
              <Check
                size={18}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500"
              />
            )}
            {phase === "feedback" && !isCorrect && (
              <X
                size={18}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500"
              />
            )}
          </div>

          {phase === "playing" && (
            <button
              onClick={handleTextSubmit}
              disabled={textAnswer.trim() === ""}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              <Check size={18} />
              {t("common.check")}
            </button>
          )}

          {/* Show correct answer on wrong text input */}
          {phase === "feedback" && !isCorrect && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">
                {t("quiz.correctAnswer")}
              </p>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                {currentQuestion.answer}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Feedback and Next button */}
      {phase === "feedback" && (
        <div className="mt-6">
          {/* Feedback message */}
          <div
            className={`rounded-xl px-4 py-3 mb-4 text-center text-sm font-semibold ${
              isCorrect
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
            }`}
          >
            {isCorrect ? t("quiz.correctFeedback") : t("quiz.incorrectFeedback")}
          </div>

          <button
            onClick={handleNext}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
          >
            {currentIndex + 1 >= questions.length
              ? t("quiz.seeResults")
              : t("common.next")}
            <ArrowRight size={18} />
          </button>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
            {t("quiz.pressEnter")}
          </p>
        </div>
      )}
    </div>
  );
}
