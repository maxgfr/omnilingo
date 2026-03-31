import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain, Check, X, RotateCcw } from "lucide-react";

interface FillExercise {
  type: "fill";
  sentence: string; // with ___ placeholder
  answer: string;
  hint?: string;
}

interface McqExercise {
  type: "mcq";
  question: string;
  options: string[];
  correctIndex: number;
}

export type Exercise = FillExercise | McqExercise;

interface ExerciseBoxProps {
  exercise: Exercise;
  onComplete?: (correct: boolean) => void;
}

export default function ExerciseBox({ exercise, onComplete }: ExerciseBoxProps) {
  const { t } = useTranslation();
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);

  const handleCheck = () => {
    if (checked) return;
    let isCorrect = false;
    if (exercise.type === "fill") {
      isCorrect = userAnswer.trim().toLowerCase() === exercise.answer.toLowerCase();
    } else {
      isCorrect = selectedOption === exercise.correctIndex;
    }
    setCorrect(isCorrect);
    setChecked(true);
    onComplete?.(isCorrect);
  };

  const handleReset = () => {
    setUserAnswer("");
    setSelectedOption(null);
    setChecked(false);
    setCorrect(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleCheck(); }
  };

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Brain size={16} className="text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">{t("tools.exercise.title")}</span>
      </div>

      {exercise.type === "fill" ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-800 dark:text-gray-200">{exercise.sentence}</p>
          {exercise.hint && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{exercise.hint}</p>}
          <div className="flex gap-2">
            <input
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={checked}
              placeholder="..."
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                checked
                  ? correct
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    : "border-rose-400 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"
                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              }`}
            />
            {!checked ? (
              <button onClick={handleCheck} disabled={!userAnswer.trim()} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                {t("common.check")}
              </button>
            ) : (
              <button onClick={handleReset} className="p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                <RotateCcw size={16} className="text-amber-600 dark:text-amber-400" />
              </button>
            )}
          </div>
          {checked && !correct && (
            <p className="text-xs text-gray-600 dark:text-gray-400">{t("common.correctAnswer")}: <strong>{exercise.answer}</strong></p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-800 dark:text-gray-200">{exercise.question}</p>
          <div className="grid grid-cols-2 gap-2">
            {exercise.options.map((opt, i) => {
              let style = "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-amber-300 dark:hover:border-amber-700";
              if (checked && i === exercise.correctIndex) {
                style = "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20";
              } else if (checked && i === selectedOption && i !== exercise.correctIndex) {
                style = "border-rose-400 bg-rose-50 dark:bg-rose-900/20";
              } else if (!checked && i === selectedOption) {
                style = "border-amber-400 bg-amber-50 dark:bg-amber-900/20";
              }
              return (
                <button
                  key={i}
                  onClick={() => { if (!checked) setSelectedOption(i); }}
                  disabled={checked}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors text-left ${style}`}
                >
                  {checked && i === exercise.correctIndex && <Check size={14} className="text-emerald-600 flex-shrink-0" />}
                  {checked && i === selectedOption && i !== exercise.correctIndex && <X size={14} className="text-rose-600 flex-shrink-0" />}
                  <span className="text-gray-800 dark:text-gray-200">{opt}</span>
                </button>
              );
            })}
          </div>
          {!checked && selectedOption !== null && (
            <button onClick={handleCheck} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors">
              {t("common.check")}
            </button>
          )}
          {checked && (
            <button onClick={handleReset} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 transition-colors">
              <RotateCcw size={12} /> {t("common.restart")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
