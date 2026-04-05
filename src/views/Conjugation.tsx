import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
  Wand2,
  Loader2,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import { speak, getSourceLang } from "../lib/speech";
import type { Verb } from "../types";

type Mode = "random" | "byTense" | "byVerb";

export default function Conjugation() {
  const { t } = useTranslation();
  const { activePair, settings } = useApp();

  const [verbs, setVerbs] = useState<Verb[]>([]);
  const [loading, setLoading] = useState(true);

  // Mode & navigation
  const [mode, setMode] = useState<Mode>("random");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTense, setSelectedTense] = useState<string>("");
  const [currentVerb, setCurrentVerb] = useState<Verb | null>(null);
  const [currentTense, setCurrentTense] = useState<string>("");

  // Form state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Stats
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // AI generation
  const [generating, setGenerating] = useState(false);

  // Dynamically extract all available tense keys from loaded verbs
  const allTenseKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const verb of verbs) {
      for (const tense of Object.keys(verb.conjugations)) {
        if (verb.conjugations[tense] && Object.keys(verb.conjugations[tense]).length > 0) {
          keys.add(tense);
        }
      }
    }
    return Array.from(keys);
  }, [verbs]);

  // Known tense translations (fallback to key itself for unknown tenses)
  const TENSE_LABELS: Record<string, string> = {
    prasens: t("conjugation.present"),
    present: t("conjugation.present"),
    prateritum: t("conjugation.past"),
    past: t("conjugation.past"),
    perfekt: t("conjugation.perfect"),
    perfect: t("conjugation.perfect"),
    futur1: t("conjugation.futureI"),
    future: t("conjugation.futureI"),
    konjunktiv2: t("conjugation.subjunctiveII"),
    subjunctive: t("conjugation.subjunctiveII"),
    imperativ: t("conjugation.imperative"),
    imperative: t("conjugation.imperative"),
    imparfait: "Imparfait",
    passe_compose: "Passe compose",
    conditionnel: "Conditionnel",
    subjonctif: "Subjonctif",
  };

  function getTenseLabel(key: string): string {
    return TENSE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
  }

  // Get available tenses for a specific verb
  function getVerbTenses(verb: Verb): string[] {
    return Object.keys(verb.conjugations).filter(
      (k) => verb.conjugations[k] && Object.keys(verb.conjugations[k]).length > 0,
    );
  }

  // Get persons for current verb/tense dynamically
  const persons = useMemo(() => {
    if (!currentVerb || !currentVerb.conjugations[currentTense]) return [];
    return Object.keys(currentVerb.conjugations[currentTense]);
  }, [currentVerb, currentTense]);

  const correctAnswers = useMemo(() => {
    if (!currentVerb || !currentVerb.conjugations[currentTense]) return {};
    return currentVerb.conjugations[currentTense];
  }, [currentVerb, currentTense]);

  useEffect(() => {
    if (!activePair) return;
    setLoading(true);
    bridge
      .getVerbs(activePair.id)
      .then((v) => {
        setVerbs(v);
        if (v.length > 0) {
          const tenses = getVerbTenses(v[0]);
          const firstTense = tenses[0] || "";
          setSelectedTense(firstTense);
          pickRandom(v, firstTense);
        }
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

  // ------ Helpers ------

  function pickRandom(pool: Verb[] = verbs, tense?: string) {
    if (pool.length === 0) return;
    const verb = pool[Math.floor(Math.random() * pool.length)];
    const availableTenses = getVerbTenses(verb);
    const picked =
      tense && availableTenses.includes(tense)
        ? tense
        : availableTenses.length > 0
          ? availableTenses[Math.floor(Math.random() * availableTenses.length)]
          : "";
    startPractice(verb, picked);
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

    let correct = 0;
    const errors: string[] = [];
    persons.forEach((person) => {
      const expected = (correctAnswers[person] || "").trim().toLowerCase();
      const given = (answers[person] || "").trim().toLowerCase();
      if (given === expected) {
        correct++;
      } else {
        errors.push(`${person}: "${given || t("conjugation.empty")}" -> "${correctAnswers[person]}"`);
      }
    });

    const allCorrect = correct === persons.length;
    setCorrectCount((c) => c + correct);
    setTotalCount((prev) => prev + persons.length);

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
      const available = getVerbTenses(currentVerb);
      const idx = available.indexOf(currentTense);
      const nextIdx = (idx + 1) % available.length;
      startPractice(currentVerb, available[nextIdx]);
    }
  }

  function handlePrevTense() {
    if (!currentVerb) return;
    const available = getVerbTenses(currentVerb);
    const idx = available.indexOf(currentTense);
    const prevIdx = (idx - 1 + available.length) % available.length;
    startPractice(currentVerb, available[prevIdx]);
  }

  function handleNextTense() {
    if (!currentVerb) return;
    const available = getVerbTenses(currentVerb);
    const idx = available.indexOf(currentTense);
    const nextIdx = (idx + 1) % available.length;
    startPractice(currentVerb, available[nextIdx]);
  }

  function selectVerb(verb: Verb) {
    const available = getVerbTenses(verb);
    startPractice(verb, available[0] || "");
  }

  function isAnswerCorrect(person: string): boolean {
    const expected = (correctAnswers[person] || "").trim().toLowerCase();
    const given = (answers[person] || "").trim().toLowerCase();
    return given === expected;
  }

  const handleGenerate = useCallback(async () => {
    if (!activePair) return;
    setGenerating(true);
    try {
      await bridge.generateVerbs(activePair.id, 20, settings?.level || "A1");
      const v = await bridge.getVerbs(activePair.id);
      setVerbs(v);
      if (v.length > 0) {
        const tenses = getVerbTenses(v[0]);
        setSelectedTense(tenses[0] || "");
        pickRandom(v, tenses[0]);
      }
    } catch (err) {
      console.error("Generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }, [activePair, settings]);

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
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-20 space-y-6">
        <BookOpen size={48} className="text-gray-300 dark:text-gray-600" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("conjugation.noVerbsAvailable")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("conjugation.emptyDescription")}</p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium text-sm transition-all shadow-sm disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {generating ? "Generating..." : "Generate with AI"}
          </button>
          <a href="#/settings" className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
            {t("dashboard.downloadDict")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("conjugation.title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("conjugation.verbsAvailable", { count: verbs.length })}
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
          {t("conjugation.random")}
        </button>
        <button
          onClick={() => {
            setMode("byTense");
            const tense = selectedTense || allTenseKeys[0] || "";
            const tensVerbs = verbs.filter(
              (v) =>
                v.conjugations[tense] &&
                Object.keys(v.conjugations[tense]).length > 0,
            );
            pickRandom(tensVerbs, tense);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === "byTense"
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500"
          }`}
        >
          <BookOpen size={16} />
          {t("conjugation.byTense")}
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
          {t("conjugation.byVerb")}
        </button>
      </div>

      {/* Tense selector (byTense mode) -- dynamic from data */}
      {mode === "byTense" && (
        <div className="flex flex-wrap gap-2">
          {allTenseKeys.map((tense) => (
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
              {getTenseLabel(tense)}
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
              placeholder={t("conjugation.searchVerb")}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {filteredVerbs.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                {t("conjugation.noVerbFound")}
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
                      getSourceLang(activePair?.source_lang || "en"),
                    )
                  }
                  className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                  title={t("common.listen")}
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
                    {t("conjugation.separable")}
                  </span>
                )}
              </div>
            </div>

            {/* Tense navigation */}
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handlePrevTense}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                title={t("conjugation.previousTense")}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 min-w-[100px] text-center">
                {getTenseLabel(currentTense)}
              </span>
              <button
                onClick={handleNextTense}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                title={t("conjugation.nextTense")}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Conjugation inputs -- persons from data */}
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

          {/* Examples -- generic keys */}
          {currentVerb.examples && currentVerb.examples.length > 0 && (
            <div className="px-6 pb-4">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 space-y-1">
                {currentVerb.examples.slice(0, 2).map((ex: Record<string, string>, i: number) => {
                  // Try common keys: source/target, de/fr, or first two keys
                  const keys = Object.keys(ex);
                  const sourceKey = keys.find((k) => ["source", "de", "en", "es", "it", "pt"].includes(k)) || keys[0];
                  const targetKey = keys.find((k) => ["target", "fr", "translation"].includes(k)) || keys[1];
                  return (
                    <div key={i} className="text-xs">
                      <span className="text-gray-600 dark:text-gray-400 italic">
                        &ldquo;{ex[sourceKey]}&rdquo;
                      </span>
                      {targetKey && ex[targetKey] && (
                        <>
                          <span className="text-gray-400 dark:text-gray-500 mx-1.5">
                            &mdash;
                          </span>
                          <span className="text-gray-500 dark:text-gray-500">
                            &ldquo;{ex[targetKey]}&rdquo;
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
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
                  {t("common.check")}
                </button>
                <button
                  onClick={handleReveal}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <Eye size={16} />
                  {t("conjugation.showAnswers")}
                </button>
              </>
            )}
            {(checked || revealed) && (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors shadow-sm"
              >
                <RotateCcw size={16} />
                {t("common.next")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
