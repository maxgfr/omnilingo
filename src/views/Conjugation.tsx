import { useEffect, useState, useMemo, useCallback } from "react";
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";
import {
  Shuffle,
  BookOpen,
  Check,
  Eye,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  List,
  Wand2,
  Loader2,
  Save,
  CheckCircle,
  Trash2,
  BarChart3,
  Timer,
} from "lucide-react";
import { useFeaturePair } from "../lib/useFeaturePair";
import { useAppStore, selectIsAiConfigured } from "../store/useAppStore";
import { addToHistory } from "../lib/ai-cache";
import * as bridge from "../lib/bridge";
import type { Verb } from "../types";
import Spinner from "../components/ui/Spinner";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import ExamplePreview from "../components/ui/ExamplePreview";
import RecentSearches from "../components/ui/RecentSearches";
import { CONJUGATION_EXAMPLE } from "../lib/exampleData";

// Module-level cache to avoid reloading on tab switch
let _conjCache: { pairId: number; verbs: Verb[] } | null = null;

function normalizeForComparison(text: string): string {
  return text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function Conjugation() {
  const { t } = useTranslation();
  const { activePair } = useFeaturePair("conjugation");
  const isAiConfigured = useAppStore(selectIsAiConfigured);

  // Restore cached state
  const cachedState = useAppStore.getState().conjugationCache;

  const [verbs, setVerbs] = useState<Verb[]>([]);
  const [loading, setLoading] = useState(true);

  // Mode & navigation
  const [mode, setMode] = useState<"random" | "byTense" | "byVerb">((cachedState?.mode as "random" | "byTense" | "byVerb") ?? "random");
  const [searchQuery, setSearchQuery] = useState(cachedState?.searchQuery ?? "");
  const [selectedTense, setSelectedTense] = useState<string>(cachedState?.selectedTense ?? "");
  const [currentVerb, setCurrentVerb] = useState<Verb | null>(null);
  const [currentTense, setCurrentTense] = useState<string>("");

  // Form state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Stats
  const [correctCount, setCorrectCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // AI verb generation
  const [aiVerbInput, setAiVerbInput] = useState("");
  const [generatingVerb, setGeneratingVerb] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savingVerb, setSavingVerb] = useState(false);
  const [verbSaved, setVerbSaved] = useState(false);

  // Stats dashboard
  const [stats, setStats] = useState<{ total_sessions: number; by_tense: Array<{ tense: string; correct: number; total: number }>; by_verb: Array<{ verb: string; correct: number; total: number }> } | null>(null);
  const [showStats, setShowStats] = useState(false);

  // Speed drill
  const [speedDrillActive, setSpeedDrillActive] = useState(false);
  const [speedDrillTimer, setSpeedDrillTimer] = useState(60);
  const [speedDrillScore, setSpeedDrillScore] = useState(0);

  const handleGenerateVerb = useCallback(async () => {
    if (!activePair || !aiVerbInput.trim() || generatingVerb) return;
    setGeneratingVerb(true);
    try {
      addToHistory(activePair.id, "conjugation", aiVerbInput.trim());
      const sourceName = activePair.source_name;
      const targetName = activePair.target_name;
      const prompt = `Generate the conjugation for the ${sourceName} verb "${aiVerbInput.trim()}".
Return a JSON object with this exact structure:
{
  "id": -1,
  "language_pair_id": ${activePair.id},
  "infinitive": "the verb infinitive in ${sourceName}",
  "translation": "translation in ${targetName}",
  "verb_type": "regular/irregular/modal",
  "auxiliary": "auxiliary verb if applicable or null",
  "is_separable": false,
  "level": "A1",
  "conjugations": {
    "present": {"ich": "form", "du": "form", "er/sie/es": "form", "wir": "form", "ihr": "form", "sie/Sie": "form"},
    "past": {"ich": "form", "du": "form", ...},
    "perfect": {"ich": "form", ...}
  },
  "examples": [{"source": "example sentence in ${sourceName}", "target": "translation in ${targetName}"}]
}
Include as many tenses as you know for this verb. Use the appropriate person labels for ${sourceName}.
Return ONLY valid JSON, no markdown fences.`;
      const response = await bridge.askAi(prompt);
      let jsonStr = response.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```\w*\n?/, "").replace(/```\s*$/, "").trim();
      }
      const parsed = JSON.parse(jsonStr) as Verb;
      const tenses = Object.keys(parsed.conjugations).filter(
        (k) => parsed.conjugations[k] && Object.keys(parsed.conjugations[k]).length > 0,
      );
      if (tenses.length > 0) {
        startPractice(parsed, tenses[0]);
      }
      setAiVerbInput("");
    } catch (err) {
      console.error("Failed to generate AI verb:", err);
    } finally {
      setGeneratingVerb(false);
    }
  }, [activePair, aiVerbInput, generatingVerb]);

  const handleBulkGenerate = useCallback(async () => {
    if (!activePair || bulkGenerating) return;
    setBulkGenerating(true);
    try {
      await bridge.generateVerbs(activePair.id, 20, "A1");
      const v = await bridge.getVerbs(activePair.id);
      _conjCache = { pairId: activePair.id, verbs: v };
      setVerbs(v);
    } catch (err) {
      console.error("Failed to generate verbs:", err);
    } finally {
      setBulkGenerating(false);
    }
  }, [activePair, bulkGenerating]);

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

  // Sync view state to Zustand cache
  useEffect(() => {
    useAppStore.getState().setConjugationCache({
      searchQuery,
      currentVerbId: currentVerb?.id ?? null,
      mode,
      selectedTense,
      aiVerb: currentVerb && currentVerb.id < 0 ? JSON.stringify(currentVerb) : null,
    });
  }, [searchQuery, currentVerb, mode, selectedTense]);

  useEffect(() => {
    const cache = useAppStore.getState().conjugationCache;
    const isRestoringCache = cache !== null;

    if (!isRestoringCache) {
      // Clear stale state from previous pair
      setCurrentVerb(null);
      setAnswers({});
      setChecked(false);
      setRevealed(false);
      setSearchQuery("");
    }

    if (!activePair) {
      setLoading(false);
      return;
    }

    const restoreVerb = (v: Verb[]) => {
      if (isRestoringCache && cache.currentVerbId != null) {
        if (cache.currentVerbId < 0 && cache.aiVerb) {
          try {
            const aiVerb = JSON.parse(cache.aiVerb) as Verb;
            const tenses = getVerbTenses(aiVerb);
            const tense = cache.selectedTense && tenses.includes(cache.selectedTense)
              ? cache.selectedTense : tenses[0] || "";
            startPractice(aiVerb, tense);
            return;
          } catch { /* ignore */ }
        }
        const restored = v.find((verb) => verb.id === cache.currentVerbId);
        if (restored) {
          const tenses = getVerbTenses(restored);
          const tense = cache.selectedTense && tenses.includes(cache.selectedTense)
            ? cache.selectedTense : tenses[0] || "";
          startPractice(restored, tense);
          return;
        }
      }
      if (v.length > 0) {
        const tenses = getVerbTenses(v[0]);
        const firstTense = tenses[0] || "";
        setSelectedTense(firstTense);
        pickRandom(v, firstTense);
      }
    };

    // Use module-level cache if pair hasn't changed
    if (_conjCache && _conjCache.pairId === activePair.id) {
      setVerbs(_conjCache.verbs);
      restoreVerb(_conjCache.verbs);
      setLoading(false);
      bridge.getConjugationStats(activePair.id).then(setStats).catch(() => {});
      return;
    }

    setLoading(true);
    bridge
      .getVerbs(activePair.id)
      .then((v) => {
        _conjCache = { pairId: activePair.id, verbs: v };
        setVerbs(v);
        restoreVerb(v);
      })
      .finally(() => setLoading(false));

    bridge.getConjugationStats(activePair.id).then(setStats).catch(() => {});
  }, [activePair]);

  // Speed drill timer
  useEffect(() => {
    if (!speedDrillActive || speedDrillTimer <= 0) return;
    const interval = setInterval(() => {
      setSpeedDrillTimer((prev) => {
        if (prev <= 1) {
          setSpeedDrillActive(false);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [speedDrillActive, speedDrillTimer <= 0]);

  const verbFuse = useMemo(
    () => new Fuse(verbs, { keys: ["infinitive", "translation"], threshold: 0.4 }),
    [verbs],
  );

  const filteredVerbs = useMemo(() => {
    if (!searchQuery.trim()) return verbs;
    return verbFuse.search(searchQuery.trim()).map((r) => r.item);
  }, [verbs, searchQuery, verbFuse]);

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
      const expected = normalizeForComparison(correctAnswers[person] || "");
      const given = normalizeForComparison(answers[person] || "");
      if (given === expected) {
        correct++;
      } else {
        errors.push(`${person}: "${(answers[person] || "").trim() || t("conjugation.empty")}" -> "${correctAnswers[person]}"`);
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

    // Speed drill: auto-advance on all correct
    if (speedDrillActive && allCorrect && speedDrillTimer > 0) {
      setSpeedDrillScore((s) => s + 1);
      setTimeout(() => handleNext(), 300);
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
    const expected = normalizeForComparison(correctAnswers[person] || "");
    const given = normalizeForComparison(answers[person] || "");
    return given === expected;
  }

  // ------ Render ------

  if (loading) {
    return <Spinner fullPage />;
  }

  if (verbs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("conjugation.title")} />

        {/* AI Verb Generator */}
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
            {t("conjugation.generateVerb", "Conjuguer un verbe avec l'IA")}
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                placeholder={t("conjugation.verbPlaceholder", "Tapez un verbe...")}
                value={aiVerbInput}
                onChange={(e) => setAiVerbInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerateVerb()}
                onFocus={() => !aiVerbInput.trim() && setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 150)}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-gray-400"
              />
              {activePair && <RecentSearches tool="conjugation" pairId={activePair.id} visible={showHistory && !aiVerbInput.trim()} onSelect={(q) => { setAiVerbInput(q); setShowHistory(false); }} />}
            </div>
            <button
              onClick={handleGenerateVerb}
              disabled={!aiVerbInput.trim() || generatingVerb}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingVerb ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("grammar.generating", "Génération...")}
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  {t("grammar.generate", "Générer")}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bulk verb generation */}
        {isAiConfigured && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-center space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("conjugation.noVerbs", "Aucun verbe pour cette paire de langues.")}
            </p>
            <button
              onClick={handleBulkGenerate}
              disabled={bulkGenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {bulkGenerating ? t("grammar.generating", "Génération...") : t("conjugation.bulkGenerate", "Générer 20 verbes courants")}
            </button>
          </div>
        )}

        <ExamplePreview onClick={() => setAiVerbInput(CONJUGATION_EXAMPLE.infinitive)}>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{CONJUGATION_EXAMPLE.infinitive}</h3>
              <span className="text-sm text-gray-500">{CONJUGATION_EXAMPLE.translation} — {CONJUGATION_EXAMPLE.tense}</span>
            </div>
            <div className="p-4 space-y-2">
              {CONJUGATION_EXAMPLE.persons.map((person, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-16 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{person}</span>
                  <span className="text-sm text-gray-900 dark:text-white">{CONJUGATION_EXAMPLE.forms[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </ExamplePreview>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t("conjugation.title")}
        subtitle={t("conjugation.verbsAvailable", { count: verbs.length })}
        rightSlot={totalCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <Check size={16} className="text-emerald-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {correctCount}/{totalCount}
            </span>
            <span className="text-xs text-gray-400">
              ({Math.round((correctCount / totalCount) * 100)}%)
            </span>
          </div>
        ) : undefined}
      />

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
        <button
          onClick={() => {
            if (speedDrillActive) {
              setSpeedDrillActive(false);
              setSpeedDrillTimer(60);
            } else {
              setSpeedDrillActive(true);
              setSpeedDrillTimer(60);
              setSpeedDrillScore(0);
              setMode("random");
              pickRandom(verbs);
            }
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            speedDrillActive
              ? "bg-rose-500 text-white shadow-sm"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-rose-400 dark:hover:border-rose-500"
          }`}
        >
          <Timer size={16} />
          {speedDrillActive ? t("conjugation.stopDrill", "Arreter") : t("conjugation.speedDrill", "Speed Drill")}
        </button>
        {stats && stats.total_sessions > 0 && (
          <button
            onClick={() => setShowStats((s) => !s)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              showStats
                ? "bg-blue-500 text-white shadow-sm"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500"
            }`}
          >
            <BarChart3 size={16} />
            {t("conjugation.stats", "Stats")}
          </button>
        )}
      </div>

      {/* Speed drill banner */}
      {speedDrillActive && (
        <div className="flex items-center justify-between px-5 py-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10">
          <div className="flex items-center gap-3">
            <Timer size={20} className="text-rose-500" />
            <span className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {Math.floor(speedDrillTimer / 60)}:{(speedDrillTimer % 60).toString().padStart(2, "0")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t("conjugation.score", "Score")}:</span>
            <span className="text-lg font-bold text-rose-600 dark:text-rose-400">{speedDrillScore}</span>
          </div>
        </div>
      )}

      {/* Speed drill results */}
      {!speedDrillActive && speedDrillTimer === 0 && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10 p-6 text-center space-y-3">
          <Timer size={32} className="mx-auto text-rose-500" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t("conjugation.drillFinished", "Temps ecoulé !")}</h3>
          <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{speedDrillScore} {t("conjugation.verbsConjugated", "verbes conjugués")}</p>
          <button
            onClick={() => {
              setSpeedDrillTimer(60);
              setSpeedDrillScore(0);
              setSpeedDrillActive(true);
              pickRandom(verbs);
            }}
            className="mt-2 px-5 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium transition-colors"
          >
            <RotateCcw size={16} className="inline mr-2" />
            {t("conjugation.restartDrill", "Recommencer")}
          </button>
        </div>
      )}

      {/* Stats dashboard */}
      {showStats && stats && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <BarChart3 size={16} />
            {t("conjugation.statsTitle", "Statistiques de conjugaison")}
            <span className="text-xs font-normal text-gray-500">({stats.total_sessions} {t("conjugation.sessions", "sessions")})</span>
          </h3>

          {/* By tense */}
          {stats.by_tense.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">{t("conjugation.byTenseStats", "Par temps")}</h4>
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="text-left px-3 py-1.5 font-medium text-gray-600 dark:text-gray-400">{t("conjugation.tense", "Temps")}</th>
                      <th className="text-right px-3 py-1.5 font-medium text-gray-600 dark:text-gray-400">{t("conjugation.result", "Résultat")}</th>
                      <th className="text-right px-3 py-1.5 font-medium text-gray-600 dark:text-gray-400">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {stats.by_tense.map((row) => (
                      <tr key={row.tense} className="bg-white dark:bg-gray-900">
                        <td className="px-3 py-1.5 text-gray-900 dark:text-white">{getTenseLabel(row.tense)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">{row.correct}/{row.total}</td>
                        <td className="px-3 py-1.5 text-right font-medium">
                          <span className={row.total > 0 && row.correct / row.total >= 0.7 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                            {row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hardest verbs */}
          {stats.by_verb.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">{t("conjugation.hardestVerbs", "Verbes les plus difficiles")}</h4>
              <div className="space-y-1.5">
                {[...stats.by_verb]
                  .filter((v) => v.total > 0)
                  .sort((a, b) => (a.correct / a.total) - (b.correct / b.total))
                  .slice(0, 8)
                  .map((row) => (
                    <div key={row.verb} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{row.verb}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{row.correct}/{row.total}</span>
                        <span className={`text-xs font-medium ${row.correct / row.total >= 0.7 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {Math.round((row.correct / row.total) * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* AI Verb Generator */}
      {isAiConfigured && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
            {t("conjugation.generateVerb", "Conjuguer un verbe avec l'IA")}
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                placeholder={t("conjugation.verbPlaceholder", "Tapez un verbe...")}
                value={aiVerbInput}
                onChange={(e) => setAiVerbInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerateVerb()}
                onFocus={() => !aiVerbInput.trim() && setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 150)}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-gray-400"
              />
              {activePair && <RecentSearches tool="conjugation" pairId={activePair.id} visible={showHistory && !aiVerbInput.trim()} onSelect={(q) => { setAiVerbInput(q); setShowHistory(false); }} />}
            </div>
            <button
              onClick={handleGenerateVerb}
              disabled={!aiVerbInput.trim() || generatingVerb}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingVerb ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("grammar.generating", "Génération...")}
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  {t("grammar.generate", "Générer")}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Verb search - always visible */}
      <div className="space-y-3">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t("conjugation.searchVerb")} />
        {(mode === "byVerb" || searchQuery.trim()) && (
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
        )}
      </div>

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
              const showCorrection = (checked || revealed) && !isCorrect;

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
            {/* Save AI verb */}
            {currentVerb && currentVerb.id < 0 && !verbSaved && (
              <button
                onClick={async () => {
                  if (!activePair || savingVerb) return;
                  setSavingVerb(true);
                  try {
                    const newId = await bridge.saveVerb(
                      activePair.id, currentVerb.infinitive, currentVerb.translation,
                      currentVerb.level ?? null, currentVerb.verb_type ?? null,
                      currentVerb.auxiliary ?? null, currentVerb.is_separable,
                      currentVerb.conjugations, currentVerb.examples ?? null,
                    );
                    setCurrentVerb({ ...currentVerb, id: newId });
                    setVerbSaved(true);
                    _conjCache = null;
                    const reloaded = await bridge.getVerbs(activePair.id);
                    setVerbs(reloaded);
                  } catch (err) { console.error("Failed to save verb:", err); }
                  finally { setSavingVerb(false); }
                }}
                disabled={savingVerb}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                {savingVerb ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {t("common.save")}
              </button>
            )}
            {verbSaved && (
              <span className="flex items-center gap-2 px-5 py-2.5 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                <CheckCircle size={16} /> {t("common.added")}
              </span>
            )}
            {currentVerb && currentVerb.id > 0 && (
              <button
                onClick={async () => {
                  if (!activePair) return;
                  await bridge.deleteVerb(currentVerb.id);
                  _conjCache = null;
                  const reloaded = await bridge.getVerbs(activePair.id);
                  setVerbs(reloaded);
                  setCurrentVerb(null);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-gray-400 hover:text-red-500 text-sm font-medium transition-colors"
              >
                <Trash2 size={16} />
                {t("common.delete")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
