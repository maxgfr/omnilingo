import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { RotateCcw, BookOpen, Trophy, Frown, SmilePlus, Smile, Zap, Volume2 } from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import { speak, getSourceLang } from "../lib/speech";
import ProgressBar from "../components/ProgressBar";
import type { SrsCard } from "../types";

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

interface SessionResults {
  correct: number;
  total: number;
  forgotten: string[];
}

export default function Review() {
  const { activePair, isGerman } = useApp();
  const [cards, setCards] = useState<SrsCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState<SessionResults>({
    correct: 0,
    total: 0,
    forgotten: [],
  });

  // Load and shuffle cards
  useEffect(() => {
    if (!activePair) return;
    setLoading(true);
    bridge
      .getDueCards(activePair.id)
      .then((c) => {
        // Fisher-Yates shuffle
        const shuffled = [...c];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setCards(shuffled);
        setCurrentIndex(0);
        setFlipped(false);
        setCompleted(false);
        setResults({ correct: 0, total: 0, forgotten: [] });
      })
      .finally(() => setLoading(false));
  }, [activePair]);

  const currentCard = cards[currentIndex] ?? null;

  const handleFlip = useCallback(() => {
    if (!currentCard || completed) return;
    setFlipped(true);
  }, [currentCard, completed]);

  const handleRate = useCallback(
    async (quality: number) => {
      if (!currentCard || !flipped) return;

      try {
        await bridge.reviewCard(currentCard.id, quality);
      } catch (err) {
        console.error("Failed to review card:", err);
      }

      const isCorrect = quality >= 3;
      const newResults: SessionResults = {
        correct: results.correct + (isCorrect ? 1 : 0),
        total: results.total + 1,
        forgotten: isCorrect
          ? results.forgotten
          : [...results.forgotten, currentCard.source_word],
      };
      setResults(newResults);

      if (currentIndex + 1 >= cards.length) {
        setCompleted(true);
      } else {
        setCurrentIndex((prev) => prev + 1);
        setFlipped(false);
      }
    },
    [currentCard, flipped, results, currentIndex, cards.length],
  );

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (completed || !currentCard) return;

      if ((e.key === " " || e.key === "Spacebar") && !flipped) {
        e.preventDefault();
        handleFlip();
        return;
      }

      if (flipped) {
        switch (e.key) {
          case "1":
            handleRate(0);
            break;
          case "2":
            handleRate(2);
            break;
          case "3":
            handleRate(3);
            break;
          case "4":
            handleRate(5);
            break;
        }
      }
    },
    [completed, currentCard, flipped, handleFlip, handleRate],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleRestart = () => {
    // Re-shuffle and restart
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setCards(shuffled);
    setCurrentIndex(0);
    setFlipped(false);
    setCompleted(false);
    setResults({ correct: 0, total: 0, forgotten: [] });
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  // Empty state: no cards due
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <span className="text-6xl mb-6">🎉</span>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Aucune carte a reviser !
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-center max-w-md">
          Toutes vos cartes sont a jour. Apprenez de nouveaux mots pour les retrouver ici plus tard.
        </p>
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors"
        >
          <BookOpen size={20} />
          Apprendre de nouveaux mots
        </Link>
      </div>
    );
  }

  // Completion screen
  if (completed) {
    const accuracy =
      results.total > 0 ? Math.round((results.correct / results.total) * 100) : 0;
    const isGood = accuracy >= 70;

    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
              isGood
                ? "bg-emerald-100 dark:bg-emerald-900/30"
                : "bg-amber-100 dark:bg-amber-900/30"
            }`}
          >
            <Trophy
              size={40}
              className={
                isGood
                  ? "text-emerald-500"
                  : "text-amber-500"
              }
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Session terminee !
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            {isGood ? "Excellent travail !" : "Continuez a pratiquer, vous progressez !"}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {results.total}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Revisees</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">{results.correct}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Correctes</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p
              className={`text-2xl font-bold ${
                isGood ? "text-emerald-500" : "text-amber-500"
              }`}
            >
              {accuracy}%
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Precision</p>
          </div>
        </div>

        {/* Forgotten words */}
        {results.forgotten.length > 0 && (
          <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-xl p-4 mb-8">
            <h3 className="font-semibold text-rose-700 dark:text-rose-400 mb-2 text-sm">
              Mots a revoir ({results.forgotten.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {results.forgotten.map((word, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 rounded-md text-sm"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRestart}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors"
          >
            <RotateCcw size={18} />
            Recommencer
          </button>
          <Link
            to="/"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-amber-400 dark:hover:border-amber-500 rounded-xl font-semibold transition-colors"
          >
            Tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  // Review card
  const genderInfo = currentCard.gender ? genderColors[currentCard.gender] : null;
  const sourceLang = getSourceLang(activePair?.source_lang || "de");

  const ratingButtons = [
    { quality: 0, label: "Oublie", icon: Frown, color: "bg-rose-500 hover:bg-rose-600", key: "1" },
    { quality: 2, label: "Difficile", icon: SmilePlus, color: "bg-orange-500 hover:bg-orange-600", key: "2" },
    { quality: 3, label: "Bien", icon: Smile, color: "bg-emerald-500 hover:bg-emerald-600", key: "3" },
    { quality: 5, label: "Facile", icon: Zap, color: "bg-blue-500 hover:bg-blue-600", key: "4" },
  ];

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      {/* Header with progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Revision</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>
        <ProgressBar value={currentIndex} max={cards.length} color="bg-amber-500" />
      </div>

      {/* Flashcard */}
      <div
        className="perspective-1000 w-full h-64 mb-6 cursor-pointer select-none"
        onClick={() => !flipped && handleFlip()}
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 transform-3d ${
            flipped ? "rotate-y-180" : ""
          }`}
        >
          {/* Front: source word */}
          <div className="absolute inset-0 backface-hidden rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col items-center justify-center p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              {isGerman() && genderInfo && (
                <span
                  className={`${genderInfo.bg} text-white text-xs px-2 py-0.5 rounded-full font-bold`}
                >
                  {genderInfo.label}
                </span>
              )}
              {currentCard.level && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    levelColors[currentCard.level] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {currentCard.level}
                </span>
              )}
            </div>
            <p
              className={`text-3xl font-bold text-center ${
                genderInfo ? genderInfo.text : "text-gray-900 dark:text-white"
              }`}
            >
              {currentCard.source_word}
            </p>
            {currentCard.plural && (
              <p className="text-sm text-gray-400 mt-2">pl. {currentCard.plural}</p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                speak(currentCard.source_word, sourceLang);
              }}
              className="mt-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
            >
              <Volume2 size={20} />
            </button>
            <p className="absolute bottom-3 text-xs text-gray-400">
              Cliquer ou Espace pour retourner
            </p>
          </div>

          {/* Back: target word */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 flex flex-col items-center justify-center p-6 shadow-sm">
            <p className="text-3xl font-bold text-amber-700 dark:text-amber-400 text-center">
              {currentCard.target_word}
            </p>
            {(currentCard.example_source || currentCard.example_target) && (
              <div className="mt-4 text-center space-y-1">
                {currentCard.example_source && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    &laquo;{currentCard.example_source}&raquo;
                  </p>
                )}
                {currentCard.example_target && (
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    &laquo;{currentCard.example_target}&raquo;
                  </p>
                )}
              </div>
            )}
            {currentCard.category && (
              <span className="mt-3 text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {currentCard.category}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons (visible only when flipped) */}
      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {ratingButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.quality}
                onClick={() => handleRate(btn.quality)}
                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-white font-medium transition-all ${btn.color} active:scale-95`}
              >
                <Icon size={20} />
                <span className="text-xs">{btn.label}</span>
                <kbd className="text-[10px] opacity-70 bg-white/20 px-1.5 py-0.5 rounded">
                  {btn.key}
                </kbd>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Appuyez sur <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Espace</kbd> pour reveler la reponse
          </p>
        </div>
      )}
    </div>
  );
}
