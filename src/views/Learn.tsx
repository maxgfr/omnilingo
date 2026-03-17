import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Volume2,
  RotateCcw,
  CheckCircle,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import Flashcard from "../components/Flashcard";
import ProgressBar from "../components/ProgressBar";
import { speak, getSourceLang } from "../lib/speech";
import type { Word } from "../types";

export default function Learn() {
  const { settings, activePair } = useApp();
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!activePair || !settings) return;
    bridge
      .getUnlearnedWords(activePair.id, settings.level, settings.words_per_day)
      .then((w) => {
        setWords(w);
        if (w.length === 0) setCompleted(true);
      })
      .finally(() => setLoading(false));
  }, [activePair, settings]);

  const currentWord = words[currentIndex] ?? null;
  const isLast = currentIndex === words.length - 1;
  const isFirst = currentIndex === 0;
  const isAdded = currentWord ? addedIds.has(currentWord.id) : false;

  const goNext = useCallback(() => {
    if (isLast) {
      setCompleted(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [isLast]);

  const goPrev = useCallback(() => {
    if (!isFirst) {
      setCurrentIndex((i) => i - 1);
    }
  }, [isFirst]);

  const handleAddToSrs = useCallback(async () => {
    if (!currentWord || isAdded || adding) return;
    setAdding(true);
    try {
      await bridge.addWordToSrs(currentWord.id);
      setAddedIds((prev) => new Set(prev).add(currentWord.id));
    } catch (err) {
      console.error("Erreur ajout SRS:", err);
    } finally {
      setAdding(false);
    }
  }, [currentWord, isAdded, adding]);

  const handleSpeak = useCallback(() => {
    if (!currentWord || !activePair) return;
    speak(currentWord.source_word, getSourceLang(activePair.source_lang));
  }, [currentWord, activePair]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setCompleted(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (completed) return;
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "a" || e.key === "A") handleAddToSrs();
      else if (e.key === "s" || e.key === "S") handleSpeak();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completed, goNext, goPrev, handleAddToSrs, handleSpeak]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Completion screen
  if (completed) {
    const addedCount = addedIds.size;
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle size={40} className="text-emerald-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Session terminee !
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            {words.length === 0
              ? "Aucun nouveau mot disponible pour le moment."
              : `Vous avez parcouru ${words.length} mot${words.length !== 1 ? "s" : ""}.`}
          </p>
        </div>

        {addedCount > 0 && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-6 py-4 text-center">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              <span className="font-bold text-lg">{addedCount}</span>{" "}
              mot{addedCount !== 1 ? "s" : ""} ajoute{addedCount !== 1 ? "s" : ""} aux revisions
            </p>
          </div>
        )}

        <div className="flex gap-3">
          {words.length > 0 && (
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              <RotateCcw size={16} />
              Revoir les mots
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Apprendre de nouveaux mots
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {words.length} mot{words.length !== 1 ? "s" : ""} a decouvrir
          </p>
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 tabular-nums">
          {currentIndex + 1} / {words.length}
        </span>
      </div>

      {/* Progress bar */}
      <ProgressBar
        value={currentIndex + 1}
        max={words.length}
        color="bg-amber-500"
        height="h-1.5"
      />

      {/* Flashcard */}
      {currentWord && (
        <div className="py-4">
          <Flashcard
            key={currentWord.id}
            sourceWord={currentWord.source_word}
            targetWord={currentWord.target_word}
            gender={currentWord.gender}
            plural={currentWord.plural}
            level={currentWord.level}
            category={currentWord.category}
            exampleSource={currentWord.example_source}
            exampleTarget={currentWord.example_target}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleSpeak}
          className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Prononcer (S)"
        >
          <Volume2 size={18} />
        </button>

        <button
          onClick={handleAddToSrs}
          disabled={isAdded || adding}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isAdded
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 cursor-default"
              : adding
                ? "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-wait border border-gray-300 dark:border-gray-600"
                : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow-md"
          }`}
        >
          {isAdded ? (
            <>
              <CheckCircle size={16} />
              Ajoute
            </>
          ) : adding ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
              Ajout...
            </>
          ) : (
            <>
              <Plus size={16} />
              Ajouter aux revisions
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={goPrev}
          disabled={isFirst}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            isFirst
              ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
          }`}
        >
          <ChevronLeft size={16} />
          Precedent
        </button>

        {/* Dot indicators (compact, max ~10 shown) */}
        <div className="flex items-center gap-1.5">
          {words.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`rounded-full transition-all ${
                i === currentIndex
                  ? "w-2.5 h-2.5 bg-amber-500"
                  : addedIds.has(words[i].id)
                    ? "w-2 h-2 bg-emerald-400"
                    : "w-2 h-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
              }`}
              title={`Mot ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-all"
        >
          {isLast ? "Terminer" : "Suivant"}
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Keyboard hint */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        Raccourcis : <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono text-[10px]">←</kbd>{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono text-[10px]">→</kbd> naviguer{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono text-[10px]">A</kbd> ajouter{" "}
        <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono text-[10px]">S</kbd> prononcer
      </p>
    </div>
  );
}
