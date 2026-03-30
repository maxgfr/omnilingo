import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2, Plus, CheckCircle, Sparkles } from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import { speak, getSourceLang } from "../lib/speech";
import type { Word } from "../types";

const genderColors: Record<string, { bg: string; text: string; label: string }> = {
  m: { bg: "bg-blue-500", text: "text-blue-500", label: "der" },
  f: { bg: "bg-rose-500", text: "text-rose-500", label: "die" },
  n: { bg: "bg-emerald-500", text: "text-emerald-500", label: "das" },
};

export default function WordOfDay() {
  const { t } = useTranslation();
  const { activePair, isGerman } = useApp();
  const [word, setWord] = useState<Word | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!activePair) return;

    // Use sessionStorage to keep the same word during the session
    const storageKey = `omnilingo-wotd-${activePair.id}`;
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      try {
        setWord(JSON.parse(stored));
        return;
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    }

    bridge.getRandomWord(activePair.id).then((w) => {
      if (w) {
        setWord(w);
        sessionStorage.setItem(storageKey, JSON.stringify(w));
      }
    });
  }, [activePair]);

  if (!word) return null;

  const handleSpeak = () => {
    const lang = getSourceLang(activePair?.source_lang || "de");
    speak(word.source_word, lang);
  };

  const handleAdd = async () => {
    try {
      await bridge.addWordToSrs(word.id);
      setAdded(true);
    } catch {
      // Word may already be in SRS
      setAdded(true);
    }
  };

  const genderInfo = word.gender ? genderColors[word.gender] : null;

  return (
    <div className="relative rounded-xl border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 overflow-hidden">
      {/* Subtle decorative accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-200/40 to-transparent dark:from-amber-700/20 rounded-bl-full pointer-events-none" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-amber-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            {t("wordOfDay.title")}
          </h3>
        </div>

        {/* Word display */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {isGerman() && genderInfo && (
                <span
                  className={`${genderInfo.bg} text-white text-xs px-2 py-0.5 rounded-full font-bold`}
                >
                  {genderInfo.label}
                </span>
              )}
              <p
                className={`text-2xl font-bold ${
                  genderInfo
                    ? genderInfo.text
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {word.source_word}
              </p>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {word.target_word}
            </p>

            {word.example_source && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic truncate">
                &ldquo;{word.example_source}&rdquo;
              </p>
            )}
          </div>

          {/* Pronunciation button */}
          <button
            onClick={handleSpeak}
            className="flex-shrink-0 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-600 transition-colors shadow-sm"
            title={t("common.listen")}
          >
            <Volume2 size={18} />
          </button>
        </div>

        {/* Add to reviews button */}
        <div className="mt-4">
          {added ? (
            <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={16} />
              <span className="font-medium">{t("common.added")}</span>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              <Plus size={16} />
              <span>{t("wordOfDay.addToReviews")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
