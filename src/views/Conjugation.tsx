import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  CheckCircle,
  ChevronLeft,
  Eye,
  Loader2,
  RotateCcw,
  Save,
  Table as TableIcon,
  Wand2,
  Pencil,
} from "lucide-react";
import { useFeaturePair } from "../lib/useFeaturePair";
import { useAppStore, selectIsAiConfigured } from "../store/useAppStore";
import * as bridge from "../lib/bridge";
import type { Verb } from "../types";
import PageHeader from "../components/ui/PageHeader";
import ExamplePreview from "../components/ui/ExamplePreview";
import { CONJUGATION_EXAMPLE } from "../lib/exampleData";
import { useExampleTranslations } from "../lib/useExampleTranslations";

type ViewMode = "table" | "practice";

function normalizeForComparison(text: string): string {
  return text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function Conjugation() {
  const { t } = useTranslation();
  const { activePair } = useFeaturePair("conjugation");
  const isAiConfigured = useAppStore(selectIsAiConfigured);
  const cachedState = useAppStore.getState().conjugationCache;

  // ── State ─────────────────────────────────────────────────────────
  const [aiVerbInput, setAiVerbInput] = useState(cachedState?.aiVerbInput ?? "");
  const [generatingVerb, setGeneratingVerb] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [savingVerb, setSavingVerb] = useState(false);
  const [verbSaved, setVerbSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [currentVerb, setCurrentVerb] = useState<Verb | null>(() => {
    if (cachedState?.aiVerb) {
      try {
        return JSON.parse(cachedState.aiVerb) as Verb;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [view, setView] = useState<ViewMode>(
    (cachedState?.view as ViewMode) ?? "table",
  );

  // Practice state (per tense)
  const [currentTense, setCurrentTense] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // ── Persist view state to Zustand cache ──────────────────────────
  useEffect(() => {
    useAppStore.getState().setConjugationCache({
      aiVerbInput,
      aiVerb: currentVerb ? JSON.stringify(currentVerb) : null,
      view,
    });
  }, [aiVerbInput, currentVerb, view]);

  // Reset stale state when active pair changes
  useEffect(() => {
    setGenerationError(null);
  }, [activePair?.id]);

  // ── Derived ──────────────────────────────────────────────────────
  const tenses = useMemo(() => {
    if (!currentVerb) return [];
    return Object.keys(currentVerb.conjugations).filter(
      (k) =>
        currentVerb.conjugations[k] &&
        Object.keys(currentVerb.conjugations[k]).length > 0,
    );
  }, [currentVerb]);

  // Make sure currentTense always points to a valid tense for the current verb
  useEffect(() => {
    if (tenses.length === 0) {
      setCurrentTense("");
      return;
    }
    if (!tenses.includes(currentTense)) {
      setCurrentTense(tenses[0]);
      setAnswers({});
      setChecked(false);
      setRevealed(false);
    }
  }, [tenses, currentTense]);

  const persons = useMemo(() => {
    if (!currentVerb || !currentVerb.conjugations[currentTense]) return [];
    return Object.keys(currentVerb.conjugations[currentTense]);
  }, [currentVerb, currentTense]);

  const correctAnswers = useMemo(() => {
    if (!currentVerb || !currentVerb.conjugations[currentTense]) return {};
    return currentVerb.conjugations[currentTense];
  }, [currentVerb, currentTense]);

  // Tense label translations
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
    imparfait: t("conjugation.imparfait"),
    passe_compose: t("conjugation.passeCompose"),
    conditionnel: t("conjugation.conditional"),
    subjonctif: t("conjugation.subjunctive"),
  };
  const getTenseLabel = (key: string): string =>
    TENSE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");

  // ── Example preview translation ─────────────────────────────────
  const { tr: trEx, loading: trExLoading } = useExampleTranslations(
    "conjugation",
    [
      CONJUGATION_EXAMPLE.infinitive,
      CONJUGATION_EXAMPLE.translation,
      ...CONJUGATION_EXAMPLE.persons,
      ...CONJUGATION_EXAMPLE.forms,
    ],
  );

  // ── AI verb generation ───────────────────────────────────────────
  const handleGenerateVerb = useCallback(async () => {
    if (!activePair || !aiVerbInput.trim() || generatingVerb) return;
    setGeneratingVerb(true);
    setGenerationError(null);
    setVerbSaved(false);
    try {
      const sourceName = activePair.source_name;
      const targetName = activePair.target_name;
      const prompt = `Conjugate the ${targetName} verb "${aiVerbInput.trim()}" for a ${sourceName}-speaking learner.

Return ONLY this JSON object — no markdown fences, no prose:
{
  "id": -1,
  "language_pair_id": ${activePair.id},
  "infinitive": "<infinitive in ${targetName}>",
  "translation": "<short translation in ${sourceName}>",
  "verb_type": "regular" | "irregular" | "modal",
  "auxiliary": "<auxiliary verb or null>",
  "is_separable": false,
  "level": "A1",
  "conjugations": {
    "<tense_name>": { "<person>": "<conjugated form>", ... }
  },
  "examples": []
}

Rules:
- Use person labels native to ${targetName} (e.g. "je/tu/il" for French, "ich/du/er" for German, "I/you/he" for English).
- Include all common tenses (present, past, future, conditional, subjunctive, etc.) with lowercase tense keys (e.g. "present", "passe_compose", "imparfait").
- If the input is not a real ${targetName} verb, respond with {"error":"not a verb"} and nothing else.`;

      const response = await bridge.askAi(prompt);
      let jsonStr = response.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```\w*\n?/, "").replace(/```\s*$/, "").trim();
      }
      if (!jsonStr.startsWith("{")) {
        const start = jsonStr.indexOf("{");
        const end = jsonStr.lastIndexOf("}");
        if (start !== -1 && end > start) {
          jsonStr = jsonStr.slice(start, end + 1);
        }
      }
      const parsed = JSON.parse(jsonStr) as Verb & { error?: string };
      if (parsed.error) {
        throw new Error(t("conjugation.notAVerb"));
      }
      if (!parsed.conjugations || typeof parsed.conjugations !== "object") {
        throw new Error(t("conjugation.invalidAiResponse"));
      }
      const verbTenses = Object.keys(parsed.conjugations).filter(
        (k) => parsed.conjugations[k] && Object.keys(parsed.conjugations[k]).length > 0,
      );
      if (verbTenses.length === 0) {
        throw new Error(t("conjugation.noTensesFound"));
      }
      // Defensive defaults — the AI prompt asks for these fields but the
      // model may omit them, which would later break the save flow (the
      // Rust SaveVerbInput requires `is_separable: bool`, not Option<bool>,
      // and the "save" button visibility check needs a numeric id < 0).
      if (typeof parsed.id !== "number") parsed.id = -1;
      if (typeof parsed.is_separable !== "boolean") parsed.is_separable = false;
      if (parsed.examples == null || !Array.isArray(parsed.examples)) parsed.examples = null;
      setCurrentVerb(parsed);
      setCurrentTense(verbTenses[0]);
      setAnswers({});
      setChecked(false);
      setRevealed(false);
      setAiVerbInput("");
    } catch (err) {
      console.error("Failed to generate AI verb:", err);
      const message = err instanceof Error ? err.message : String(err);
      setGenerationError(message || t("conjugation.generationFailed"));
    } finally {
      setGeneratingVerb(false);
    }
  }, [activePair, aiVerbInput, generatingVerb, t]);

  // ── Save AI-generated verb to DB ─────────────────────────────────
  const handleSaveVerb = useCallback(async () => {
    if (!activePair || !currentVerb || savingVerb) return;
    setSavingVerb(true);
    setSaveError(null);
    try {
      const newId = await bridge.saveVerb(
        activePair.id,
        currentVerb.infinitive,
        currentVerb.translation,
        currentVerb.level ?? null,
        currentVerb.verb_type ?? null,
        currentVerb.auxiliary ?? null,
        currentVerb.is_separable === true,
        currentVerb.conjugations,
        currentVerb.examples ?? null,
      );
      setCurrentVerb({ ...currentVerb, id: newId });
      setVerbSaved(true);
    } catch (err) {
      console.error("Failed to save verb:", err);
      const message = err instanceof Error ? err.message : String(err);
      // Safety net: if the user is running an older binary that still has
      // the plain INSERT (pre-UPSERT migration), a UNIQUE constraint just
      // means "already saved earlier" — surface that as success rather
      // than as a confusing red error.
      if (message.includes("UNIQUE constraint")) {
        setVerbSaved(true);
      } else {
        setSaveError(message);
      }
    } finally {
      setSavingVerb(false);
    }
  }, [activePair, currentVerb, savingVerb]);

  // ── Clear current verb (return to AI input + example preview) ───
  const handleClearVerb = useCallback(() => {
    setCurrentVerb(null);
    setCurrentTense("");
    setAnswers({});
    setChecked(false);
    setRevealed(false);
    setVerbSaved(false);
    setGenerationError(null);
    setView("table");
    setAiVerbInput("");
  }, []);

  // ── Practice handlers ────────────────────────────────────────────
  function handleAnswerChange(person: string, value: string) {
    if (checked || revealed) return;
    setAnswers((prev) => ({ ...prev, [person]: value }));
  }

  function handleCheck() {
    setChecked(true);
  }

  function handleReveal() {
    setRevealed(true);
    setChecked(true);
  }

  function handleResetTense() {
    setAnswers({});
    setChecked(false);
    setRevealed(false);
  }

  function isAnswerCorrect(person: string): boolean {
    const expected = normalizeForComparison(correctAnswers[person] || "");
    const given = normalizeForComparison(answers[person] || "");
    return given === expected;
  }

  // ── Render ───────────────────────────────────────────────────────
  if (!isAiConfigured) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("conjugation.title")} />
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-5 text-sm text-amber-700 dark:text-amber-400">
          {t("settings.configureAi")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("conjugation.title")}
        subtitle={currentVerb ? `${currentVerb.infinitive} — ${currentVerb.translation}` : undefined}
      />

      {/* AI verb generator */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
          {t("conjugation.generateVerb")}
        </p>
        <div className="flex gap-3">
          <input
            placeholder={t("conjugation.verbPlaceholder")}
            value={aiVerbInput}
            onChange={(e) => setAiVerbInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerateVerb()}
            autoComplete="off"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-gray-400"
          />
          <button
            onClick={handleGenerateVerb}
            disabled={!aiVerbInput.trim() || generatingVerb}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingVerb ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("grammar.generating")}
              </>
            ) : (
              <>
                <Wand2 size={16} />
                {t("grammar.generate")}
              </>
            )}
          </button>
        </div>
        {generationError && (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{generationError}</p>
        )}
      </div>

      {/* Example preview when no verb generated yet */}
      {!currentVerb && (
        <ExamplePreview
          loading={trExLoading}
          onClick={() => setAiVerbInput(trEx(CONJUGATION_EXAMPLE.infinitive))}
        >
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{trEx(CONJUGATION_EXAMPLE.infinitive)}</h3>
              <span className="text-sm text-gray-500">{trEx(CONJUGATION_EXAMPLE.translation)}</span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {CONJUGATION_EXAMPLE.persons.map((person, i) => (
                <div key={i} className="flex items-baseline gap-3">
                  <span className="w-20 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{trEx(person)}</span>
                  <span className="text-sm text-gray-900 dark:text-white">{trEx(CONJUGATION_EXAMPLE.forms[i])}</span>
                </div>
              ))}
            </div>
          </div>
        </ExamplePreview>
      )}

      {currentVerb && tenses.length > 0 && (
        <>
          {/* View toggle + save */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === "table"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500"
              }`}
            >
              <TableIcon size={16} />
              {t("conjugation.viewTable")}
            </button>
            <button
              onClick={() => setView("practice")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === "practice"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500"
              }`}
            >
              <Pencil size={16} />
              {t("conjugation.practice")}
            </button>

            {/* Save button — for AI-generated verbs that aren't yet
                persisted to the DB. We track this purely via `verbSaved`
                because the AI sometimes ignores our prompt and returns a
                positive id, which used to hide the button entirely. */}
            {!verbSaved && (
              <button
                onClick={handleSaveVerb}
                disabled={savingVerb}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {savingVerb ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {t("common.save")}
              </button>
            )}
            {verbSaved && (
              <span className="ml-auto flex items-center gap-2 px-4 py-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                <CheckCircle size={16} /> {t("common.added")}
              </span>
            )}

            {/* Back to the empty/example state */}
            <button
              onClick={handleClearVerb}
              className="inline-flex items-center gap-2 px-4 py-2 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-amber-400 dark:hover:border-amber-500 rounded-lg text-sm font-medium transition-colors"
            >
              <ChevronLeft size={16} />
              {t("common.back")}
            </button>
          </div>

          {saveError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{saveError}</p>
          )}

          {/* Table view: full conjugation table for all tenses */}
          {view === "table" && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {tenses.map((tense) => {
                  const forms = currentVerb.conjugations[tense];
                  return (
                    <div key={tense} className="p-5">
                      <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-3">
                        {getTenseLabel(tense)}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(forms).map(([person, form]) => (
                          <div key={person} className="flex items-baseline gap-3">
                            <span className="w-24 text-right text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
                              {person}
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white font-medium">
                              {form}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Practice view: type each form, check answers */}
          {view === "practice" && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              {/* Tense selector */}
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap gap-2">
                {tenses.map((tense) => (
                  <button
                    key={tense}
                    onClick={() => {
                      setCurrentTense(tense);
                      setAnswers({});
                      setChecked(false);
                      setRevealed(false);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      currentTense === tense
                        ? "bg-amber-500 text-white"
                        : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:border-amber-400"
                    }`}
                  >
                    {getTenseLabel(tense)}
                  </button>
                ))}
              </div>

              {/* Inputs */}
              <div className="p-6 space-y-3">
                {persons.map((person) => {
                  const userAnswer = answers[person] || "";
                  const expected = correctAnswers[person] || "";
                  const correct = checked ? isAnswerCorrect(person) : null;
                  const showCorrection = (checked || revealed) && correct === false;

                  return (
                    <div key={person} className="flex items-center gap-3">
                      <span className="w-24 text-right text-sm font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {person}
                      </span>
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={revealed ? expected : userAnswer}
                          onChange={(e) => handleAnswerChange(person, e.target.value)}
                          disabled={checked || revealed}
                          autoComplete="off"
                          spellCheck={false}
                          className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all ${
                            correct === true
                              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200 focus:ring-emerald-400/40"
                              : correct === false
                                ? "border-rose-400 bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-200 focus:ring-rose-400/40"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-amber-500/40 focus:border-amber-500"
                          }`}
                        />
                        {showCorrection && (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                            → {expected}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

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
                    onClick={handleResetTense}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors shadow-sm"
                  >
                    <RotateCcw size={16} />
                    {t("conjugation.tryAgain")}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
