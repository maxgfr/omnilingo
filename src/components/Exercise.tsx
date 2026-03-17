import { useState } from "react";
import { Check, X } from "lucide-react";

interface QCMProps {
  question: string;
  options: string[];
  correctIndex: number;
  onAnswer: (correct: boolean) => void;
}

export function QCM({ question, options, correctIndex, onAnswer }: QCMProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;

  const handleSelect = (i: number) => {
    if (answered) return;
    setSelected(i);
    onAnswer(i === correctIndex);
  };

  return (
    <div className="space-y-3">
      <p className="font-medium text-gray-900 dark:text-white">{question}</p>
      <div className="space-y-2">
        {options.map((opt, i) => {
          let style = "border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500";
          if (answered) {
            if (i === correctIndex) style = "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20";
            else if (i === selected) style = "border-rose-500 bg-rose-50 dark:bg-rose-900/20";
            else style = "border-gray-200 dark:border-gray-700 opacity-50";
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={answered}
              className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm ${style} ${!answered ? "cursor-pointer" : ""}`}
            >
              <span className="flex items-center gap-2">
                {answered && i === correctIndex && <Check size={16} className="text-emerald-500" />}
                {answered && i === selected && i !== correctIndex && <X size={16} className="text-rose-500" />}
                {opt}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface FillBlankProps {
  sentence: string;
  answer: string;
  hint?: string;
  onAnswer: (correct: boolean) => void;
}

export function FillBlank({ sentence, answer, hint, onAnswer }: FillBlankProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = value.trim().toLowerCase() === answer.toLowerCase();

  const handleSubmit = () => {
    if (submitted || !value.trim()) return;
    setSubmitted(true);
    onAnswer(isCorrect);
  };

  const parts = sentence.split("___");

  return (
    <div className="space-y-3">
      <p className="font-medium text-gray-900 dark:text-white">
        {parts[0]}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={submitted}
          placeholder={hint || "..."}
          className={`mx-1 px-2 py-1 border-2 rounded-md text-sm w-32 outline-none transition-colors ${
            submitted
              ? isCorrect
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-rose-500 bg-rose-50 dark:bg-rose-900/20"
              : "border-gray-300 dark:border-gray-600 focus:border-amber-500 bg-white dark:bg-gray-800"
          } text-gray-900 dark:text-white`}
        />
        {parts[1]}
      </p>
      {!submitted && (
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Check
        </button>
      )}
      {submitted && !isCorrect && (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Correct answer: <strong>{answer}</strong>
        </p>
      )}
    </div>
  );
}

interface TrueFalseProps {
  statement: string;
  isTrue: boolean;
  explanation?: string;
  onAnswer: (correct: boolean) => void;
}

export function TrueFalse({ statement, isTrue, explanation, onAnswer }: TrueFalseProps) {
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState<boolean | null>(null);

  const handleAnswer = (answer: boolean) => {
    if (answered) return;
    setAnswered(true);
    setUserAnswer(answer);
    onAnswer(answer === isTrue);
  };

  const isCorrect = userAnswer === isTrue;

  return (
    <div className="space-y-3">
      <p className="font-medium text-gray-900 dark:text-white">{statement}</p>
      <div className="flex gap-3">
        <button
          onClick={() => handleAnswer(true)}
          disabled={answered}
          className={`flex-1 py-3 rounded-lg border-2 font-medium text-sm transition-all ${
            answered && isTrue
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700"
              : answered && userAnswer === true && !isTrue
              ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700"
              : "border-gray-200 dark:border-gray-700 hover:border-emerald-400"
          }`}
        >
          True
        </button>
        <button
          onClick={() => handleAnswer(false)}
          disabled={answered}
          className={`flex-1 py-3 rounded-lg border-2 font-medium text-sm transition-all ${
            answered && !isTrue
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700"
              : answered && userAnswer === false && isTrue
              ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700"
              : "border-gray-200 dark:border-gray-700 hover:border-rose-400"
          }`}
        >
          False
        </button>
      </div>
      {answered && explanation && (
        <p className={`text-sm ${isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {explanation}
        </p>
      )}
    </div>
  );
}
