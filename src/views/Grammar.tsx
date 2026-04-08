import { type ReactElement, useEffect, useState, useCallback, useMemo } from "react";
import Fuse from "fuse.js";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  CheckCircle,
  Circle,
  MessageCircle,
  Trophy,
  Wand2,
  Loader2,
  Clock,
} from "lucide-react";
import { useFeaturePair } from "../lib/useFeaturePair";
import { useAppStore } from "../store/useAppStore";
import { addToHistory } from "../lib/ai-cache";
import * as bridge from "../lib/bridge";
import { QCM, FillBlank, TrueFalse } from "../components/Exercise";
import Spinner from "../components/ui/Spinner";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import ExamplePreview from "../components/ui/ExamplePreview";
import RecentSearches from "../components/ui/RecentSearches";
import { GRAMMAR_EXAMPLE } from "../lib/exampleData";
import type { GrammarTopic, GrammarSrsState, Exercise } from "../types";

const levelColors: Record<string, string> = {
  A1: "text-emerald-600 dark:text-emerald-400",
  A2: "text-blue-600 dark:text-blue-400",
  B1: "text-amber-600 dark:text-amber-400",
  B2: "text-purple-600 dark:text-purple-400",
  C1: "text-rose-600 dark:text-rose-400",
  C2: "text-red-600 dark:text-red-400",
};

/** Simple inline markdown: **bold** and *italic* */
function renderMarkdown(text: string) {
  const parts: (string | ReactElement)[] = [];
  // Match **bold** and *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Push text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <em key={match.index} className="italic">
          {match[3]}
        </em>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export default function Grammar() {
  const { t } = useTranslation();
  const { activePair } = useFeaturePair("grammar");
  const navigate = useNavigate();

  // Restore cached state
  const cachedState = useAppStore.getState().grammarCache;

  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [exerciseResults, setExerciseResults] = useState<boolean[]>([]);
  const [exercisesDone, setExercisesDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState(cachedState?.searchQuery ?? "");

  // SRS due topics
  const [dueTopics, setDueTopics] = useState<GrammarSrsState[]>([]);

  // AI lesson generator
  const [aiTopic, setAiTopic] = useState(cachedState?.aiTopic ?? "");
  const [aiLesson, setAiLesson] = useState<GrammarTopic | null>(null);
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Sync view state to Zustand cache
  useEffect(() => {
    useAppStore.getState().setGrammarCache({
      searchQuery,
      selectedTopicId: selectedTopic?.id ?? null,
      aiTopic,
      aiLesson: aiLesson ? JSON.stringify(aiLesson) : null,
    });
  }, [searchQuery, selectedTopic, aiTopic, aiLesson]);

  // Load topics and due SRS topics
  useEffect(() => {
    const cache = useAppStore.getState().grammarCache;
    const isRestoringCache = cache !== null;

    if (!isRestoringCache) {
      // Clear stale state from previous pair
      setSelectedTopic(null);
      setExerciseResults([]);
      setExercisesDone(false);
      setAiLesson(null);
    } else if (cache?.aiLesson) {
      // Restore AI-generated lesson from cache
      try {
        const restored = JSON.parse(cache.aiLesson) as GrammarTopic;
        setAiLesson(restored);
      } catch { /* ignore parse errors */ }
    }

    if (!activePair) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      bridge.getGrammarTopics(activePair.id),
      bridge.getDueGrammarTopics(activePair.id),
    ])
      .then(([loadedTopics, loadedDue]) => {
        setTopics(loadedTopics);
        setDueTopics(loadedDue);

        // Restore selected topic from cache
        if (isRestoringCache && cache.selectedTopicId != null) {
          if (cache.selectedTopicId === "ai-generated" && cache.aiLesson) {
            try {
              const restored = JSON.parse(cache.aiLesson) as GrammarTopic;
              setSelectedTopic(restored);
              setAiLesson(restored);
            } catch { /* ignore */ }
          } else {
            const restored = loadedTopics.find((tp) => tp.id === cache.selectedTopicId);
            if (restored) setSelectedTopic(restored);
          }
        }
      })
      .catch((err) => console.error("Failed to load grammar topics:", err))
      .finally(() => setLoading(false));
  }, [activePair]);

  // Fuse instance for fuzzy search
  const fuse = useMemo(
    () => new Fuse(topics, { keys: ["title", "title_source", "explanation"], threshold: 0.4 }),
    [topics],
  );

  // Filter topics based on search query
  const filteredTopics = searchQuery.trim()
    ? fuse.search(searchQuery.trim()).map((r) => r.item)
    : topics;

  // Group topics by level
  const topicsByLevel = filteredTopics.reduce<Record<string, GrammarTopic[]>>((acc, topic) => {
    const level = topic.level || "Other";
    if (!acc[level]) acc[level] = [];
    acc[level].push(topic);
    return acc;
  }, {});

  // Sort levels in CEFR order
  const levelOrder = ["A1", "A2", "B1", "B2", "C1", "C2", "Other"];
  const sortedLevels = Object.keys(topicsByLevel).sort(
    (a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b),
  );

  // Set of topic IDs that are due for SRS review
  const dueTopicIds = useMemo(() => new Set(dueTopics.map((d) => d.topic_id)), [dueTopics]);

  const selectTopic = useCallback((topic: GrammarTopic) => {
    setSelectedTopic(topic);
    setExerciseResults([]);
    setExercisesDone(false);
  }, []);

  const goBackToList = useCallback(() => {
    setSelectedTopic(null);
    setExerciseResults([]);
    setExercisesDone(false);
    // Reload topics and due list to reflect any completion/review changes
    if (activePair) {
      bridge.getGrammarTopics(activePair.id).then((topics) => setTopics(topics));
      bridge.getDueGrammarTopics(activePair.id).then((due) => setDueTopics(due));
    }
  }, [activePair]);

  const handleExerciseAnswer = useCallback(
    async (index: number, correct: boolean) => {
      const newResults = [...exerciseResults];
      newResults[index] = correct;
      setExerciseResults(newResults);

      if (!correct && activePair) {
        bridge.logSession(activePair.id, "grammar_error", {
          topic: selectedTopic?.title,
          exerciseIndex: index,
        }).catch(() => {});
      }

      // Check if all exercises are answered
      const totalExercises = selectedTopic?.exercises?.length || 0;
      const answeredCount = newResults.filter((r) => r !== undefined).length;

      if (answeredCount >= totalExercises) {
        setExercisesDone(true);
        const correctCount = newResults.filter((r) => r === true).length;

        // Mark as completed if score >= 70% and schedule SRS review
        if (selectedTopic && activePair && totalExercises > 0) {
          const scorePercent = (correctCount / totalExercises) * 100;
          const passed = scorePercent >= 70;
          if (passed) {
            try {
              await bridge.markGrammarCompleted(
                selectedTopic.id,
                activePair.id,
                correctCount,
                totalExercises,
              );
            } catch (err) {
              console.error("Failed to mark grammar completed:", err);
            }
          }
          // Schedule SRS review: quality 3 for passing, 1 for failing
          try {
            await bridge.reviewGrammarTopic(
              selectedTopic.id,
              activePair.id,
              passed ? 3 : 1,
            );
          } catch (err) {
            console.error("Failed to schedule grammar SRS review:", err);
          }
        }
      }
    },
    [exerciseResults, selectedTopic, activePair],
  );

  // Generate grammar lesson with AI
  const handleGenerateLesson = useCallback(async () => {
    if (!activePair || !aiTopic.trim() || generatingLesson) return;
    setGeneratingLesson(true);
    try {
      addToHistory(activePair.id, "grammar", aiTopic.trim());
      const sourceName = activePair.source_name;
      const targetName = activePair.target_name;
      const prompt = `Generate a grammar lesson about "${aiTopic.trim()}" for a ${sourceName}-${targetName} learner.
Return a JSON object with this exact structure:
{
  "id": "ai-generated",
  "language_pair_id": ${activePair.id},
  "level": "A2",
  "display_order": 0,
  "title": "lesson title in ${targetName}",
  "title_source": "lesson title in ${sourceName}",
  "explanation": "detailed explanation in ${targetName} with **bold** for important terms",
  "key_points": ["key point 1", "key point 2", "key point 3"],
  "examples": [{"source": "example in ${sourceName}", "target": "translation in ${targetName}", "highlight": "key word to highlight"}],
  "exercises": [
    {"type": "qcm", "question": "question text", "options": ["option1", "option2", "option3", "option4"], "correctIndex": 0},
    {"type": "fill", "sentence": "sentence with ___ blank", "answer": "correct answer", "hint": "hint"},
    {"type": "trueFalse", "statement": "a statement", "isTrue": true, "explanation": "why"}
  ],
  "completed": false,
  "score_correct": 0,
  "score_total": 0
}
Return ONLY valid JSON, no markdown fences.`;
      const response = await bridge.askAi(prompt);
      let jsonStr = response.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```\w*\n?/, "").replace(/```\s*$/, "").trim();
      }
      const parsed = JSON.parse(jsonStr) as GrammarTopic;
      setAiLesson(parsed);
      setSelectedTopic(parsed);
      setExerciseResults([]);
      setExercisesDone(false);
      setAiTopic("");
    } catch (err) {
      console.error("Failed to generate AI lesson:", err);
    } finally {
      setGeneratingLesson(false);
    }
  }, [activePair, aiTopic, generatingLesson]);

  const askClaude = useCallback(() => {
    if (!selectedTopic) return;
    const question = encodeURIComponent(
      `Explique-moi le sujet de grammaire : "${selectedTopic.title}". ${selectedTopic.explanation}`,
    );
    navigate(`/chat?q=${question}`);
  }, [selectedTopic, navigate]);

  // Loading state
  if (loading) {
    return <Spinner fullPage />;
  }

  // Empty state — just show AI generator (no icon/message clutter)
  if (topics.length === 0 && !aiLesson) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("grammar.title")} />

        {/* AI Lesson Generator */}
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
            {t("grammar.generateLesson")}
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                placeholder={t("grammar.topicPlaceholder")}
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerateLesson()}
                onFocus={() => !aiTopic.trim() && setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 150)}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-gray-400"
              />
              {activePair && <RecentSearches tool="grammar" pairId={activePair.id} visible={showHistory && !aiTopic.trim()} onSelect={(q) => { setAiTopic(q); setShowHistory(false); }} />}
            </div>
            <button
              onClick={handleGenerateLesson}
              disabled={!aiTopic.trim() || generatingLesson}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingLesson ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("grammar.generating")}
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

        <ExamplePreview onClick={() => setAiTopic(GRAMMAR_EXAMPLE.title)}>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-left">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">A2</span>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">{GRAMMAR_EXAMPLE.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{GRAMMAR_EXAMPLE.explanation}</p>
            <div className="mt-3 space-y-1">
              {GRAMMAR_EXAMPLE.examples.map((ex, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <span className="text-gray-900 dark:text-white">{ex.source}</span>
                  <span className="text-gray-400">—</span>
                  <span className="text-gray-500">{ex.target}</span>
                </div>
              ))}
            </div>
          </div>
        </ExamplePreview>
      </div>
    );
  }

  // Topic detail view (including AI-generated lessons)
  if (selectedTopic) {
    const exercises = selectedTopic.exercises || [];
    const correctCount = exerciseResults.filter((r) => r === true).length;
    const totalExercises = exercises.length;
    const scorePercent =
      totalExercises > 0 ? Math.round((correctCount / totalExercises) * 100) : 0;
    const passed = scorePercent >= 70;

    return (
      <div className="space-y-6">
        {/* Back button and title */}
        <button
          onClick={() => {
            if (aiLesson && selectedTopic?.id === "ai-generated") {
              setAiLesson(null);
            }
            goBackToList();
          }}
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 mb-4 transition-colors"
        >
          <ChevronLeft size={16} />
          {t("grammar.backToTopics")}
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            {selectedTopic.level && (
              <span
                className={`text-xs font-semibold ${
                  levelColors[selectedTopic.level] || "text-gray-500"
                }`}
              >
                {selectedTopic.level}
              </span>
            )}
            {selectedTopic.completed && (
              <CheckCircle size={16} className="text-emerald-500" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {selectedTopic.title}
          </h1>
          {selectedTopic.title_source && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {selectedTopic.title_source}
            </p>
          )}
        </div>

        {/* Explanation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-3">
            {selectedTopic.explanation.split("\n").map((paragraph, i) => (
              <p key={i}>{renderMarkdown(paragraph)}</p>
            ))}
          </div>
        </div>

        {/* Key points */}
        {selectedTopic.key_points && selectedTopic.key_points.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-3 text-sm uppercase tracking-wide">
              {t("grammar.keyPoints")}
            </h3>
            <ul className="space-y-2">
              {selectedTopic.key_points.map((point, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span>{renderMarkdown(point)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Examples table */}
        {selectedTopic.examples && selectedTopic.examples.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                {t("grammar.examples")}
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {selectedTopic.examples.map((ex, i) => (
                <div key={i} className="px-5 py-3 flex flex-col sm:flex-row sm:gap-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                    {ex.highlight ? (
                      <>
                        {ex.source.split(ex.highlight).map((part, j, arr) => (
                          <span key={j}>
                            {part}
                            {j < arr.length - 1 && (
                              <mark className="bg-amber-200 dark:bg-amber-700/50 text-amber-900 dark:text-amber-200 px-0.5 rounded">
                                {ex.highlight}
                              </mark>
                            )}
                          </span>
                        ))}
                      </>
                    ) : (
                      ex.source
                    )}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex-1">
                    {ex.target}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exercises */}
        {exercises.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>{t("grammar.exercises")}</span>
              {exercisesDone && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    passed
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                  }`}
                >
                  {correctCount}/{totalExercises} ({scorePercent}%)
                </span>
              )}
            </h3>
            <div className="space-y-6">
              {exercises.map((exercise: Exercise, i: number) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
                >
                  <div className="text-xs text-gray-400 dark:text-gray-500 mb-3 font-medium uppercase tracking-wide">
                    {t("grammar.exerciseProgress", { current: i + 1, total: totalExercises })}
                  </div>
                  {exercise.type === "qcm" && exercise.question && exercise.options && exercise.correctIndex !== undefined && (
                    <QCM
                      question={exercise.question}
                      options={exercise.options}
                      correctIndex={exercise.correctIndex}
                      onAnswer={(correct) => handleExerciseAnswer(i, correct)}
                    />
                  )}
                  {exercise.type === "fill" && exercise.sentence && exercise.answer && (
                    <FillBlank
                      sentence={exercise.sentence}
                      answer={exercise.answer}
                      hint={exercise.hint}
                      onAnswer={(correct) => handleExerciseAnswer(i, correct)}
                    />
                  )}
                  {exercise.type === "trueFalse" && exercise.statement !== undefined && exercise.isTrue !== undefined && (
                    <TrueFalse
                      statement={exercise.statement}
                      isTrue={exercise.isTrue}
                      explanation={exercise.explanation}
                      onAnswer={(correct) => handleExerciseAnswer(i, correct)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completion result */}
        {exercisesDone && (
          <div
            className={`rounded-xl p-5 mb-6 text-center ${
              passed
                ? "bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800"
                : "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800"
            }`}
          >
            <Trophy
              size={32}
              className={`mx-auto mb-2 ${
                passed ? "text-emerald-500" : "text-amber-500"
              }`}
            />
            <p
              className={`font-semibold ${
                passed
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-amber-700 dark:text-amber-400"
              }`}
            >
              {passed
                ? t("grammar.wellDone")
                : t("grammar.keepPracticing")}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t("grammar.score", { correct: correctCount, total: totalExercises })}
            </p>
          </div>
        )}

        {/* Ask Claude button */}
        <div className="flex gap-3">
          <button
            onClick={askClaude}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <MessageCircle size={16} />
            {t("grammar.askClaude")}
          </button>
          <button
            onClick={goBackToList}
            className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-amber-400 dark:hover:border-amber-500 rounded-xl text-sm font-semibold transition-colors"
          >
            <ChevronLeft size={16} />
            {t("common.back")}
          </button>
        </div>
      </div>
    );
  }

  // Topic list view
  return (
    <div className="space-y-6">
      <PageHeader title={t("grammar.title")} subtitle={t("grammar.topicsCompleted", { count: topics.filter((tp) => tp.completed).length })} />

      {/* Due for review banner */}
      {dueTopics.length > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
          <Clock size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
            {dueTopics.length === 1
              ? t("grammar.dueForReview", { count: 1 })
              : t("grammar.dueForReview", { count: dueTopics.length })}
          </p>
        </div>
      )}

      {/* AI Lesson Generator - always visible */}
      <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
          {t("grammar.generateLesson")}
        </p>
        <div className="flex gap-3">
          <input
            placeholder={t("grammar.topicPlaceholder")}
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerateLesson()}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all placeholder:text-gray-400"
          />
          <button
            onClick={handleGenerateLesson}
            disabled={!aiTopic.trim() || generatingLesson}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingLesson ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("grammar.generating")}
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

      <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t("grammar.searchTopics")} />

      <div className="space-y-8">
        {sortedLevels.map((level) => {
          const levelLabelKeys: Record<string, string> = {
            A1: t("grammar.levelBeginner"),
            A2: t("grammar.levelElementary"),
            B1: t("grammar.levelIntermediate"),
            B2: t("grammar.levelAdvanced"),
            C1: t("grammar.levelProficient"),
            C2: t("grammar.levelMastery"),
          };
          const levelInfo = {
            label: level === "Other" ? t("grammar.other") : `${level} - ${levelLabelKeys[level] || level}`,
            color: levelColors[level] || "text-gray-600 dark:text-gray-400",
          };
          const levelTopics = topicsByLevel[level].sort(
            (a, b) => a.display_order - b.display_order,
          );
          const completedInLevel = levelTopics.filter((tp) => tp.completed).length;

          return (
            <div key={level}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-sm font-bold uppercase tracking-wide ${levelInfo.color}`}>
                  {levelInfo.label}
                </h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {completedInLevel}/{levelTopics.length}
                </span>
              </div>
              <div className="space-y-2">
                {levelTopics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => selectTopic(topic)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500 transition-colors group"
                  >
                    {topic.completed ? (
                      <CheckCircle
                        size={20}
                        className="text-emerald-500 flex-shrink-0"
                      />
                    ) : (
                      <Circle
                        size={20}
                        className="text-gray-300 dark:text-gray-600 flex-shrink-0 group-hover:text-amber-400"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {topic.title}
                      </p>
                      {topic.title_source && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {topic.title_source}
                        </p>
                      )}
                    </div>
                    {dueTopicIds.has(topic.id) && (
                      <span title={t("grammar.dueReview")}>
                        <Clock size={14} className="text-amber-500 flex-shrink-0" />
                      </span>
                    )}
                    {topic.score_total > 0 && (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          topic.score_correct / topic.score_total >= 0.7
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {Math.round(
                          (topic.score_correct / topic.score_total) * 100,
                        )}
                        %
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
