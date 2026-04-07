import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

interface FlashcardProps {
  sourceWord: string;
  targetWord: string;
  gender?: string | null;
  plural?: string | null;
  level?: string | null;
  category?: string | null;
  exampleSource?: string | null;
  exampleTarget?: string | null;
  flipped?: boolean;
  onFlip?: () => void;
  sourceLang?: string;
}

const genderColors: Record<string, { bg: string; text: string; label: string }> = {
  m: { bg: "bg-blue-500", text: "text-blue-500", label: "der" },
  f: { bg: "bg-rose-500", text: "text-rose-500", label: "die" },
  n: { bg: "bg-emerald-500", text: "text-emerald-500", label: "das" },
};

const levelColors: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  A2: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  B1: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  B2: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function Flashcard({
  sourceWord, targetWord, gender, plural, level, category,
  exampleSource, exampleTarget, flipped = false, onFlip, sourceLang,
}: FlashcardProps) {
  const { t } = useTranslation();
  const [isFlipped, setIsFlipped] = useState(flipped);

  useEffect(() => {
    setIsFlipped(flipped);
  }, [flipped]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    onFlip?.();
  };

  const genderInfo = gender ? genderColors[gender] : null;

  return (
    <div className="perspective-1000 w-full max-w-md h-64 mx-auto cursor-pointer" onClick={handleFlip}>
      <div className={`relative w-full h-full transition-transform duration-500 transform-3d ${isFlipped ? "rotate-y-180" : ""}`}>
        {/* Front */}
        <div className="absolute inset-0 backface-hidden rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col items-center justify-center p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            {sourceLang === "de" && genderInfo && (
              <span className={`${genderInfo.bg} text-white text-xs px-2 py-0.5 rounded-full font-bold`}>
                {genderInfo.label}
              </span>
            )}
            {level && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${levelColors[level] || "bg-gray-100 text-gray-600"}`}>
                {level}
              </span>
            )}
          </div>
          <p className={`text-3xl font-bold text-center ${genderInfo ? genderInfo.text : "text-gray-900 dark:text-white"}`}>
            {sourceWord}
          </p>
          {plural && <p className="text-sm text-gray-400 mt-2">pl. {plural}</p>}
          <p className="absolute bottom-3 text-xs text-gray-400">{t("flashcard.clickToFlip")}</p>
        </div>

        {/* Back */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 flex flex-col items-center justify-center p-6 shadow-sm">
          <p className="text-3xl font-bold text-amber-700 dark:text-amber-400 text-center">{targetWord}</p>
          {(exampleSource || exampleTarget) && (
            <div className="mt-4 text-center space-y-1">
              {exampleSource && <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{exampleSource}"</p>}
              {exampleTarget && <p className="text-sm text-gray-500 dark:text-gray-500">"{exampleTarget}"</p>}
            </div>
          )}
          {category && (
            <span className="mt-3 text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {category}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
