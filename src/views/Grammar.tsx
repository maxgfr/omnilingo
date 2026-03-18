import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  CheckCircle,
  Circle,
  MessageCircle,
  Trophy,
  BookOpen,
  Search,
  Wand2,
  Loader2,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import { QCM, FillBlank, TrueFalse } from "../components/Exercise";
import type { GrammarTopic, Exercise } from "../types";

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
  const parts: (string | React.ReactElement)[] = [];
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
  const { activePair } = useApp();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [exerciseResults, setExerciseResults] = useState<boolean[]>([]);
  const [exercisesDone, setExercisesDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // AI lesson generator
  const [showAiLesson, setShowAiLesson] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiLesson, setAiLesson] = useState<GrammarTopic | null>(null);
  const [generatingLesson, setGeneratingLesson] = useState(false);

  // Load topics
  useEffect(() => {
    if (!activePair) return;
    setLoading(true);
    bridge
      .getGrammarTopics(activePair.id)
      .then((topics) => setTopics(topics))
      .catch((err) => console.error("Failed to load grammar topics:", err))
      .finally(() => setLoading(false));
  }, [activePair]);

  // Filter topics based on search query
  const filteredTopics = searchQuery.trim()
    ? topics.filter(tp =>
        tp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tp.level.toLowerCase().includes(searchQuery.toLowerCase())
      )
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

  const selectTopic = useCallback((topic: GrammarTopic) => {
    setSelectedTopic(topic);
    setExerciseResults([]);
    setExercisesDone(false);
  }, []);

  const goBackToList = useCallback(() => {
    setSelectedTopic(null);
    setExerciseResults([]);
    setExercisesDone(false);
    // Reload topics to reflect any completion changes
    if (activePair) {
      bridge.getGrammarTopics(activePair.id).then((topics) => setTopics(topics));
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

        // Mark as completed if score >= 70%
        if (selectedTopic && activePair && totalExercises > 0) {
          const scorePercent = (correctCount / totalExercises) * 100;
          if (scorePercent >= 70) {
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
      setShowAiLesson(false);
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  // Empty state
  if (topics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <BookOpen size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {t("grammar.noTopics")}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          {t("grammar.noTopics")}
        </p>
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
      <div className="max-w-2xl mx-auto py-6 px-4">
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
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("grammar.title")}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("grammar.topicsCompleted", { count: topics.filter((tp) => tp.completed).length })}
        </p>
      </div>

      {/* AI Lesson Generator */}
      <div className="mb-4 space-y-3">
        <button
          onClick={() => setShowAiLesson(!showAiLesson)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
            showAiLesson
              ? "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          <Wand2 size={16} />
          {t("grammar.generateLesson")}
        </button>

        {showAiLesson && (
          <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 p-4 space-y-3">
            <div className="flex gap-3">
              <input
                placeholder={t("grammar.topicPlaceholder")}
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all placeholder:text-gray-400"
              />
            </div>
            <button
              onClick={handleGenerateLesson}
              disabled={!aiTopic.trim() || generatingLesson}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingLesson ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("grammar.generating")}
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  {t("grammar.generateLesson")}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("grammar.searchTopics")}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-gray-400"
        />
      </div>

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
