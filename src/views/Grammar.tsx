import { type ReactElement, useEffect, useState, useCallback, useMemo } from "react";
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  CheckCircle,
  Circle,
  Trophy,
  Wand2,
  Loader2,
  Clock,
  Save,
  Trash2,
  Send,
  MessageCircle,
  PenLine,
} from "lucide-react";
import { useFeaturePair } from "../lib/useFeaturePair";
import { useAppStore, selectIsAiConfigured } from "../store/useAppStore";
import { addToHistory } from "../lib/ai-cache";
import { formatMessage } from "../lib/markdown";
import * as bridge from "../lib/bridge";
import { QCM, FillBlank, TrueFalse } from "../components/Exercise";
import Spinner from "../components/ui/Spinner";
import PageHeader from "../components/ui/PageHeader";
import SearchInput from "../components/ui/SearchInput";
import ExamplePreview from "../components/ui/ExamplePreview";
import RecentSearches from "../components/ui/RecentSearches";
import { GRAMMAR_EXAMPLE } from "../lib/exampleData";
import type { GrammarTopic, GrammarSrsState, Exercise } from "../types";

// Module-level cache to avoid reloading on tab switch
let _grammarCache: { pairId: number; topics: GrammarTopic[]; dueTopics: GrammarSrsState[] } | null = null;

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
  const isAiConfigured = useAppStore(selectIsAiConfigured);

  // Restore cached state
  const cachedState = useAppStore.getState().grammarCache;

  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [exerciseResults, setExerciseResults] = useState<boolean[]>([]);
  const [exercisesDone, setExercisesDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState(cachedState?.searchQuery ?? "");
  const [statusFilter, setStatusFilter] = useState<"all" | "due" | "completed" | "notStarted">("all");

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

    const restoreSelected = (loadedTopics: GrammarTopic[]) => {
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
    };

    // Use module-level cache if pair hasn't changed
    if (_grammarCache && _grammarCache.pairId === activePair.id) {
      setTopics(_grammarCache.topics);
      setDueTopics(_grammarCache.dueTopics);
      restoreSelected(_grammarCache.topics);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      bridge.getGrammarTopics(activePair.id),
      bridge.getDueGrammarTopics(activePair.id),
    ])
      .then(([loadedTopics, loadedDue]) => {
        _grammarCache = { pairId: activePair.id, topics: loadedTopics, dueTopics: loadedDue };
        setTopics(loadedTopics);
        setDueTopics(loadedDue);
        restoreSelected(loadedTopics);
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

  // Filter topics based on status filter
  const statusFilteredTopics = filteredTopics.filter((topic) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "due") return dueTopicIds.has(topic.id);
    if (statusFilter === "completed") return topic.completed;
    if (statusFilter === "notStarted") return !topic.completed && !topic.score_total;
    return true;
  });

  // Group topics by level
  const topicsByLevel = statusFilteredTopics.reduce<Record<string, GrammarTopic[]>>((acc, topic) => {
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
    setEditing(false);
    setEditForm(null);
    // Reload topics and due list to reflect any completion/review changes
    if (activePair) {
      _grammarCache = null; // invalidate cache
      bridge.getGrammarTopics(activePair.id).then((t) => setTopics(t));
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
  "explanation": "detailed explanation in ${sourceName} with **bold** for important terms",
  "key_points": ["key point 1", "key point 2", "key point 3"],
  "examples": [{"source": "example in ${targetName}", "target": "translation in ${sourceName}", "highlight": "key word to highlight"}],
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

  // ── Save AI lesson to DB ──
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveLesson = useCallback(async () => {
    if (!activePair || !selectedTopic || saving) return;
    setSaving(true);
    try {
      const newId = await bridge.saveGrammarTopic({
        pairId: activePair.id,
        level: selectedTopic.level || "A2",
        title: selectedTopic.title,
        titleSource: selectedTopic.title_source ?? undefined,
        explanation: selectedTopic.explanation,
        keyPoints: selectedTopic.key_points,
        examples: selectedTopic.examples,
        exercises: selectedTopic.exercises,
      });
      // Update the topic in-place with the new DB id
      const updatedTopic = { ...selectedTopic, id: newId };
      setSelectedTopic(updatedTopic);
      setAiLesson(null); // No longer "ai-generated"
      setSaved(true);
      // Reload topics
      _grammarCache = null;
      const reloaded = await bridge.getGrammarTopics(activePair.id);
      setTopics(reloaded);
    } catch (err) {
      console.error("Failed to save lesson:", err);
    } finally {
      setSaving(false);
    }
  }, [activePair, selectedTopic, saving]);

  // ── Edit topic ──
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ title: string; explanation: string; keyPoints: string[] } | null>(null);

  const handleSaveEdit = useCallback(async () => {
    if (!activePair || !selectedTopic || !editForm) return;
    try {
      // Delete old and re-create with edits
      if (selectedTopic.id !== "ai-generated") {
        await bridge.deleteGrammarTopic(selectedTopic.id, activePair.id);
      }
      const newId = await bridge.saveGrammarTopic({
        pairId: activePair.id,
        level: selectedTopic.level || "A2",
        title: editForm.title,
        titleSource: selectedTopic.title_source ?? undefined,
        explanation: editForm.explanation,
        keyPoints: editForm.keyPoints,
        examples: selectedTopic.examples,
        exercises: selectedTopic.exercises,
      });
      _grammarCache = null;
      const reloaded = await bridge.getGrammarTopics(activePair.id);
      setTopics(reloaded);
      const updated = reloaded.find((t) => t.id === newId);
      if (updated) setSelectedTopic(updated);
      setEditing(false);
      setEditForm(null);
    } catch (err) {
      console.error("Failed to save edit:", err);
    }
  }, [activePair, selectedTopic, editForm]);

  // ── Delete topic ──
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteTopic = useCallback(async () => {
    if (!activePair || !selectedTopic) return;
    try {
      await bridge.deleteGrammarTopic(selectedTopic.id, activePair.id);
      _grammarCache = null;
      setConfirmDelete(false);
      goBackToList();
    } catch (err) {
      console.error("Failed to delete topic:", err);
    }
  }, [activePair, selectedTopic, goBackToList]);

  // ── Inline AI chat ──
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || chatLoading || !selectedTopic || !activePair) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user", content: userMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const systemPrompt = `You are a bilingual grammar tutor for ${activePair.source_name} and ${activePair.target_name}.
The current lesson is about "${selectedTopic.title}".
Lesson content: ${selectedTopic.explanation}
Answer questions about this topic. Be concise. Write explanations in ${activePair.source_name}, but always include examples and grammar forms in both ${activePair.source_name} and ${activePair.target_name}.`;

      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...newMessages.slice(-10),
      ];
      const response = await bridge.askAiConversation(apiMessages);
      setChatMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Erreur: ${err}` }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, selectedTopic, activePair]);

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
          {editing && editForm ? (
            <input
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full text-2xl font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {selectedTopic.title}
            </h1>
          )}
          {selectedTopic.title_source && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {selectedTopic.title_source}
            </p>
          )}
        </div>

        {/* Explanation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
          {editing && editForm ? (
            <textarea
              value={editForm.explanation}
              onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
              rows={8}
              className="w-full text-gray-700 dark:text-gray-300 leading-relaxed bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 resize-y"
            />
          ) : (
            <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-3">
              {selectedTopic.explanation.split("\n").map((paragraph, i) => (
                <p key={i}>{renderMarkdown(paragraph)}</p>
              ))}
            </div>
          )}
        </div>

        {/* Key points */}
        {editing && editForm ? (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-3 text-sm uppercase tracking-wide">
              {t("grammar.keyPoints")}
            </h3>
            <div className="space-y-2">
              {editForm.keyPoints.map((point, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={point}
                    onChange={(e) => {
                      const updated = [...editForm.keyPoints];
                      updated[i] = e.target.value;
                      setEditForm({ ...editForm, keyPoints: updated });
                    }}
                    className="flex-1 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                  />
                  <button
                    onClick={() => {
                      const updated = editForm.keyPoints.filter((_, j) => j !== i);
                      setEditForm({ ...editForm, keyPoints: updated });
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setEditForm({ ...editForm, keyPoints: [...editForm.keyPoints, ""] })}
                className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-medium"
              >
                + {t("grammar.addKeyPoint", "Ajouter un point")}
              </button>
            </div>
          </div>
        ) : selectedTopic.key_points && selectedTopic.key_points.length > 0 ? (
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
        ) : null}

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

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Save button (only for AI-generated unsaved lessons) */}
          {aiLesson && selectedTopic?.id === "ai-generated" && !saved && (
            <button
              onClick={handleSaveLesson}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {t("common.save")}
            </button>
          )}
          {saved && (
            <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm font-semibold">
              <CheckCircle size={16} />
              {t("common.save")}
            </span>
          )}

          {/* Save/Cancel edit buttons */}
          {editing && editForm && (
            <>
              <button
                onClick={handleSaveEdit}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Save size={16} />
                {t("common.save")}
              </button>
              <button
                onClick={() => { setEditing(false); setEditForm(null); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-sm font-semibold transition-colors"
              >
                {t("common.cancel")}
              </button>
            </>
          )}

          {/* Chat toggle */}
          {isAiConfigured && (
            <button
              onClick={() => { setShowChat(!showChat); if (!showChat) setChatMessages([]); }}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                showChat
                  ? "bg-amber-500 text-white"
                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
              }`}
            >
              <MessageCircle size={16} />
              {t("grammar.askAi", "Poser une question")}
            </button>
          )}

          {/* Edit button */}
          {selectedTopic && selectedTopic.id !== "ai-generated" && !editing && (
            <button
              onClick={() => {
                setEditing(true);
                setEditForm({
                  title: selectedTopic.title,
                  explanation: selectedTopic.explanation,
                  keyPoints: selectedTopic.key_points || [],
                });
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-amber-500 rounded-xl text-sm font-semibold transition-colors"
            >
              <PenLine size={16} />
            </button>
          )}

          {/* Delete button */}
          {selectedTopic && selectedTopic.id !== "ai-generated" && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteTopic}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {t("common.confirm")}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl text-sm font-semibold transition-colors"
                >
                  {t("common.cancel")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-red-500 rounded-xl text-sm font-semibold transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )
          )}

          <button
            onClick={goBackToList}
            className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-amber-400 dark:hover:border-amber-500 rounded-xl text-sm font-semibold transition-colors"
          >
            <ChevronLeft size={16} />
            {t("common.back")}
          </button>
        </div>

        {/* Inline AI Chat */}
        {showChat && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="max-h-64 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  {t("grammar.askAboutTopic", "Posez une question sur cette leçon...")}
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-amber-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1" dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                    ) : msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2">
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                placeholder={t("grammar.askAboutTopic", "Posez une question...")}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-gray-400"
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || chatLoading}
                className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
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

      <div className="flex flex-wrap gap-2">
        {(["all", "due", "completed", "notStarted"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === filter
                ? "bg-amber-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {filter === "all" ? t("common.all", "Tous")
              : filter === "due" ? t("grammar.dueReview", "À réviser")
              : filter === "completed" ? t("grammar.completed", "Complété")
              : t("grammar.notStarted", "Non commencé")}
            {filter === "due" && dueTopics.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px]">{dueTopics.length}</span>
            )}
          </button>
        ))}
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
              <div className="flex items-center gap-3 mb-3">
                <h2 className={`text-sm font-bold uppercase tracking-wide ${levelInfo.color}`}>
                  {levelInfo.label}
                </h2>
                <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${levelTopics.length > 0 ? (completedInLevel / levelTopics.length) * 100 : 0}%` }}
                  />
                </div>
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
