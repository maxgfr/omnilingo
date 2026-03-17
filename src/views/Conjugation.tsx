import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Shuffle,
  BookOpen,
  Check,
  Eye,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  List,
  Volume2,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import { speak, getSourceLang } from "../lib/speech";
import type { Verb } from "../types";

const PERSONS = ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"];
const IMPERATIVE_PERSONS = ["du", "ihr", "Sie"];
const TENSE_LABELS: Record<string, string> = {
  prasens: "Present",
  prateritum: "Past",
  perfekt: "Perfect",
  futur1: "Future I",
  konjunktiv2: "Subjunctive II",
  imperativ: "Imperative",
};
const TENSE_KEYS = Object.keys(TENSE_LABELS);

type Mode = "random" | "byTense" | "byVerb";

export default function Conjugation() {
  const { activePair } = useApp();

  const [verbs, setVerbs] = useState<Verb[]>([]);
  const [loading, setLoading] = useState(true);

  // Mode & navigation
  const [mode, setMode] = useState<Mode>("random");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTense, setSelectedTense] = useState<string>("prasens");
  const [currentVerb, setCurrentVerb] = useState<Verb | null>(null);
  const [currentTense, setCurrentTense] = useState<string>("prasens");

  // Form state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Stats
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!activePair) return;
    setLoading(true);
    bridge
      .getVerbs(activePair.id)
      .then((v) => {
        setVerbs(v);
        if (v.length > 0) pickRandom(v, "prasens");
      })
      .finally(() => setLoading(false));
  }, [activePair]);

  const filteredVerbs = useMemo(() => {
    if (!searchQuery.trim()) return verbs;
    const q = searchQuery.toLowerCase();
    return verbs.filter(
      (v) =>
        v.infinitive.toLowerCase().includes(q) ||
        v.translation.toLowerCase().includes(q),
    );
  }, [verbs, searchQuery]);

  const persons =
    currentTense === "imperativ" ? IMPERATIVE_PERSONS : PERSONS;

  const correctAnswers = useMemo(() => {
    if (!currentVerb || !currentVerb.conjugations[currentTense]) return {};
    return currentVerb.conjugations[currentTense];
  }, [currentVerb, currentTense]);

  // ------ Helpers ------

  function pickRandom(pool: Verb[] = verbs, tense?: string) {
    if (pool.length === 0) return;
    const verb = pool[Math.floor(Math.random() * pool.length)];
    const availableTenses = TENSE_KEYS.filter(
      (t) => verb.conjugations[t] && Object.keys(verb.conjugations[t]).length > 0,
    );
    const t =
      tense && availableTenses.includes(tense)
        ? tense
        : availableTenses.length > 0
          ? availableTenses[Math.floor(Math.random() * availableTenses.length)]
          : "prasens";
    startPractice(verb, t);
  }

  function startPractice(verb: Verb, tense: string) {
    setCurrentVerb(verb);
    setCurrentTense(tense);
    setAnswers({});
    setChecked(false);
    setRevealed(false);
  }

  function handleAnswerChange(person: string, value: string) {
    if (checked || revealed) return;
    setAnswers((prev) => ({ ...prev, [person]: value }));
  }

  function handleCheck() {
    if (!currentVerb) return;
    setChecked(true);

    const p = currentTense === "imperativ" ? IMPERATIVE_PERSONS : PERSONS;
    let correct = 0;
    const errors: string[] = [];
    p.forEach((person) => {
      const expected = (correctAnswers[person] || "").trim().toLowerCase();
      const given = (answers[person] || "").trim().toLowerCase();
      if (given === expected) {
        correct++;
      } else {
        errors.push(`${person}: "${given || "(empty)"}" -> "${correctAnswers[person]}"`);
      }
    });

    const allCorrect = correct === p.length;
    setCorrectCount((c) => c + correct);
    setTotalCount((t) => t + p.length);

    if (activePair) {
      bridge
        .logConjugationSession(
          activePair.id,
          currentVerb.infinitive,
          currentTense,
          allCorrect,
          errors,
        )
        .catch(() => {});
    }
  }

  function handleReveal() {
    setRevealed(true);
    setChecked(true);
  }

  function handleNext() {
    if (mode === "random") {
      pickRandom(verbs);
    } else if (mode === "byTense") {
      const tensVerbs = verbs.filter(
        (v) =>
          v.conjugations[selectedTense] &&
          Object.keys(v.conjugations[selectedTense]).length > 0,
      );
      pickRandom(tensVerbs, selectedTense);
    } else if (mode === "byVerb" && currentVerb) {
      // Go to next tense for same verb
      const available = TENSE_KEYS.filter(
        (t) =>
          currentVerb.conjugations[t] &&
          Object.keys(currentVerb.conjugations[t]).length > 0,
      );
      const idx = available.indexOf(currentTense);
      const nextIdx = (idx + 1) % available.length;
      startPractice(currentVerb, available[nextIdx]);
    }
  }

  function handlePrevTense() {
    if (!currentVerb) return;
    const available = TENSE_KEYS.filter(
      (t) =>
        currentVerb.conjugations[t] &&
        Object.keys(currentVerb.conjugations[t]).length > 0,
    );
    const idx = available.indexOf(currentTense);
    const prevIdx = (idx - 1 + available.length) % available.length;
    startPractice(currentVerb, available[prevIdx]);
  }

  function handleNextTense() {
    if (!currentVerb) return;
    const available = TENSE_KEYS.filter(
      (t) =>
        currentVerb.conjugations[t] &&
        Object.keys(currentVerb.conjugations[t]).length > 0,
    );
    const idx = available.indexOf(currentTense);
    const nextIdx = (idx + 1) % available.length;
    startPractice(currentVerb, available[nextIdx]);
  }

  function selectVerb(verb: Verb) {
    const available = TENSE_KEYS.filter(
      (t) =>
        verb.conjugations[t] && Object.keys(verb.conjugations[t]).length > 0,
    );
    startPractice(verb, available[0] || "prasens");
  }

  function isAnswerCorrect(person: string): boolean {
    const expected = (correctAnswers[person] || "").trim().toLowerCase();
    const given = (answers[person] || "").trim().toLowerCase();
    return given === expected;
  }

  // ------ Render ------

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (verbs.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No verbs available</p>
        <p className="text-sm mt-1">
          Import data to start conjugation practice.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Conjugation
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {verbs.length} verb{verbs.length !== 1 ? "s" : ""} available
          </p>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <Check size={16} className="text-emerald-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {correctCount}/{totalCount}
            </span>
            <span className="text-xs text-gray-400">
              ({totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0}
              %)
            </span>
          </div>
        )}
      </div>

      {/* Mode selector */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setMode("random");
            pickRandom(verbs);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "random"
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500"
          }`}
        >
          <Shuffle size={16} />
          Random
        </button>
        <button
          onClick={() => {
            setMode("byTense");
            const tensVerbs = verbs.filter(
              (v) =>
                v.conjugations[selectedTense] &&
                Object.keys(v.conjugations[selectedTense]).length > 0,
            );
            pickRandom(tensVerbs, selectedTense);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "byTense"
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500"
          }`}
        >
          <BookOpen size={16} />
          By tense
        </button>
        <button
          onClick={() => setMode("byVerb")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "byVerb"
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500"
          }`}
        >
          <List size={16} />
          By verb
        </button>
      </div>

      {/* Tense selector (byTense mode) */}
      {mode === "byTense" && (
        <div className="flex flex-wrap gap-2">
          {TENSE_KEYS.map((tense) => (
            <button
              key={tense}
              onClick={() => {
                setSelectedTense(tense);
                const tensVerbs = verbs.filter(
                  (v) =>
                    v.conjugations[tense] &&
                    Object.keys(v.conjugations[tense]).length > 0,
                );
                pickRandom(tensVerbs, tense);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                selectedTense === tense
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {TENSE_LABELS[tense]}
            </button>
          ))}
        </div>
      )}

      {/* Verb search (byVerb mode) */}
      {mode === "byVerb" && (
        <div className="space-y-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search verb..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {filteredVerbs.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                No verb found
              </div>
            ) : (
              filteredVerbs.map((verb) => (
                <button
                  key={verb.id}
                  onClick={() => selectVerb(verb)}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                    currentVerb?.id === verb.id
                      ? "bg-amber-50 dark:bg-amber-900/20"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {verb.infinitive}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs">
                      {verb.translation}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {verb.level && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          verb.level === "A1"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : verb.level === "A2"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {verb.level}
                      </span>
                    )}
                    {verb.verb_type && (
                      <span className="text-xs text-gray-400">
                        {verb.verb_type}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Conjugation form */}
      {currentVerb && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          {/* Verb header */}
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {currentVerb.infinitive}
                </h2>
                <button
                  onClick={() =>
                    speak(
                      currentVerb.infinitive,
                      getSourceLang(activePair?.source_lang || "de"),
                    )
                  }
                  className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                  title="Listen"
                >
                  <Volume2 size={16} />
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {currentVerb.translation}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentVerb.verb_type && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium">
                    {currentVerb.verb_type}
                  </span>
                )}
                {currentVerb.auxiliary && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 font-medium">
                    {currentVerb.auxiliary}
                  </span>
                )}
                {currentVerb.is_separable && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 font-medium">
                    separable
                  </span>
                )}
              </div>
            </div>

            {/* Tense navigation */}
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handlePrevTense}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                title="Previous tense"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 min-w-[100px] text-center">
                {TENSE_LABELS[currentTense] || currentTense}
              </span>
              <button
                onClick={handleNextTense}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                title="Next tense"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Conjugation inputs */}
          <div className="p-6 space-y-3">
            {persons.map((person) => {
              const userAnswer = answers[person] || "";
              const expected = correctAnswers[person] || "";
              const isCorrect = checked ? isAnswerCorrect(person) : null;
              const showCorrection =
                checked && !isCorrect && (checked || revealed);

              return (
                <div key={person} className="flex items-center gap-3">
                  <span className="w-24 text-right text-sm font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {person}
                  </span>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={revealed ? expected : userAnswer}
                      onChange={(e) =>
                        handleAnswerChange(person, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !checked) handleCheck();
                      }}
                      disabled={checked || revealed}
                      placeholder="..."
                      className={`w-full px-3 py-2 rounded-lg border-2 text-sm outline-none transition-all ${
                        isCorrect === null
                          ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                          : isCorrect
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                            : "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"
                      } placeholder:text-gray-300 dark:placeholder:text-gray-600`}
                    />
                    {isCorrect === true && (
                      <Check
                        size={16}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"
                      />
                    )}
                  </div>
                  {showCorrection && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 font-medium min-w-[80px]">
                      {expected}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Examples */}
          {currentVerb.examples && currentVerb.examples.length > 0 && (
            <div className="px-6 pb-4">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 space-y-1">
                {currentVerb.examples.slice(0, 2).map((ex, i) => (
                  <div key={i} className="text-xs">
                    <span className="text-gray-600 dark:text-gray-400 italic">
                      "{ex.de}"
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 mx-1.5">
                      —
                    </span>
                    <span className="text-gray-500 dark:text-gray-500">
                      "{ex.fr}"
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-6 pb-6 flex flex-wrap gap-3">
            {!checked && !revealed && (
              <>
                <button
                  onClick={handleCheck}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors shadow-sm"
                >
                  <Check size={16} />
                  Check
                </button>
                <button
                  onClick={handleReveal}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <Eye size={16} />
                  Show answers
                </button>
              </>
            )}
            {(checked || revealed) && (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors shadow-sm"
              >
                <RotateCcw size={16} />
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
