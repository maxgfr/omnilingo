import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  CheckCircle,
  Circle,
  MessageCircle,
  Trophy,
  BookOpen,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import { QCM, FillBlank, TrueFalse } from "../components/Exercise";
import type { GrammarTopic, Exercise } from "../types";

const levelLabels: Record<string, { label: string; color: string }> = {
  A1: { label: "A1 - Debutant", color: "text-emerald-600 dark:text-emerald-400" },
  A2: { label: "A2 - Elementaire", color: "text-blue-600 dark:text-blue-400" },
  B1: { label: "B1 - Intermediaire", color: "text-amber-600 dark:text-amber-400" },
  B2: { label: "B2 - Avance", color: "text-purple-600 dark:text-purple-400" },
  C1: { label: "C1 - Autonome", color: "text-rose-600 dark:text-rose-400" },
  C2: { label: "C2 - Maitrise", color: "text-red-600 dark:text-red-400" },
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
  const { activePair } = useApp();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [exerciseResults, setExerciseResults] = useState<boolean[]>([]);
  const [exercisesDone, setExercisesDone] = useState(false);

  // Load topics
  useEffect(() => {
    if (!activePair) return;
    setLoading(true);
    bridge
      .getGrammarTopics(activePair.id)
      .then((t) => setTopics(t))
      .catch((err) => console.error("Failed to load grammar topics:", err))
      .finally(() => setLoading(false));
  }, [activePair]);

  // Group topics by level
  const topicsByLevel = topics.reduce<Record<string, GrammarTopic[]>>((acc, topic) => {
    const level = topic.level || "Autre";
    if (!acc[level]) acc[level] = [];
    acc[level].push(topic);
    return acc;
  }, {});

  // Sort levels in CEFR order
  const levelOrder = ["A1", "A2", "B1", "B2", "C1", "C2", "Autre"];
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
      bridge.getGrammarTopics(activePair.id).then((t) => setTopics(t));
    }
  }, [activePair]);

  const handleExerciseAnswer = useCallback(
    async (index: number, correct: boolean) => {
      const newResults = [...exerciseResults];
      newResults[index] = correct;
      setExerciseResults(newResults);

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
          Aucun sujet de grammaire
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
          Les sujets de grammaire seront disponibles apres l'import des donnees pour cette paire de langues.
        </p>
      </div>
    );
  }

  // Topic detail view
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
          onClick={goBackToList}
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 mb-4 transition-colors"
        >
          <ChevronLeft size={16} />
          Retour aux sujets
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            {selectedTopic.level && (
              <span
                className={`text-xs font-semibold ${
                  levelLabels[selectedTopic.level]?.color || "text-gray-500"
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
              Points cles
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
                Exemples
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
              <span>Exercices</span>
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
                    Exercice {i + 1} / {totalExercises}
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
                ? "Bravo ! Sujet valide !"
                : "Continuez a pratiquer. Il faut 70% pour valider."}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Score : {correctCount}/{totalExercises} ({scorePercent}%)
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
            Demander a Claude
          </button>
          <button
            onClick={goBackToList}
            className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-amber-400 dark:hover:border-amber-500 rounded-xl text-sm font-semibold transition-colors"
          >
            <ChevronLeft size={16} />
            Retour
          </button>
        </div>
      </div>
    );
  }

  // Topic list view
  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Grammaire</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {topics.filter((t) => t.completed).length} / {topics.length} sujets completes
        </p>
      </div>

      <div className="space-y-8">
        {sortedLevels.map((level) => {
          const levelInfo = levelLabels[level] || {
            label: level,
            color: "text-gray-600 dark:text-gray-400",
          };
          const levelTopics = topicsByLevel[level].sort(
            (a, b) => a.display_order - b.display_order,
          );
          const completedInLevel = levelTopics.filter((t) => t.completed).length;

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
