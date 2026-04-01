import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle, Circle, Lock, ChevronRight,
  BookOpen, Target, ArrowRight,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import type { GrammarTopic, SrsStats } from "../types";

interface PathNode {
  id: string;
  title: string;
  level: string;
  status: "completed" | "available" | "locked";
  score: number;
  type: "grammar" | "vocabulary";
}

const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string; fill: string }> = {
  A1: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", fill: "bg-emerald-500" },
  A2: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-400", fill: "bg-blue-500" },
  B1: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", fill: "bg-amber-500" },
  B2: { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-400", fill: "bg-purple-500" },
  C1: { bg: "bg-rose-50 dark:bg-rose-900/20", border: "border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-400", fill: "bg-rose-500" },
  C2: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-400", fill: "bg-red-500" },
};

// Determine how many vocab milestones to insert based on available grammar topics
function buildVocabMilestones(level: string, totalCards: number, learnedForLevel: number): PathNode[] {
  const milestones = [
    { count: 25, label: "25 words" },
    { count: 50, label: "50 words" },
    { count: 100, label: "100 words" },
    { count: 200, label: "200 words" },
  ];

  return milestones.map((m) => ({
    id: `vocab-${level}-${m.count}`,
    title: `${m.label} ${level}`,
    level,
    status: learnedForLevel >= m.count ? "completed" as const : totalCards > 0 ? "available" as const : "locked" as const,
    score: Math.min(100, Math.round((learnedForLevel / m.count) * 100)),
    type: "vocabulary" as const,
  }));
}

export default function LearningPath() {
  const { t } = useTranslation();
  const { activePair, settings } = useApp();
  const navigate = useNavigate();
  const [grammarTopics, setGrammarTopics] = useState<GrammarTopic[]>([]);
  const [srsStats, setSrsStats] = useState<SrsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePair) return;
    Promise.all([
      bridge.getGrammarTopics(activePair.id),
      bridge.getSrsStats(activePair.id),
    ]).then(([topics, stats]) => {
      setGrammarTopics(topics);
      setSrsStats(stats);
    }).finally(() => setLoading(false));
  }, [activePair]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  const userLevel = settings?.level || "A1";
  const userLevelIdx = LEVEL_ORDER.indexOf(userLevel);

  // Build path nodes from grammar topics + vocabulary milestones
  const pathByLevel: Record<string, PathNode[]> = {};
  for (const level of LEVEL_ORDER) {
    const levelIdx = LEVEL_ORDER.indexOf(level);
    const isUnlocked = levelIdx <= userLevelIdx;

    // Grammar nodes
    const grammarNodes: PathNode[] = grammarTopics
      .filter((tp) => tp.level === level)
      .map((tp) => ({
        id: tp.id,
        title: tp.title,
        level,
        status: tp.completed ? "completed" : (isUnlocked ? "available" : "locked"),
        score: tp.score_total > 0 ? Math.round((tp.score_correct / tp.score_total) * 100) : 0,
        type: "grammar" as const,
      }));

    // Vocabulary milestones
    const vocabNodes = buildVocabMilestones(
      level,
      srsStats?.total_cards ?? 0,
      // Rough estimate - use total for now
      Math.round((srsStats?.total_cards ?? 0) / Math.max(LEVEL_ORDER.indexOf(userLevel) + 1, 1)),
    );

    // Interleave: vocab milestone, then grammar nodes
    const combined: PathNode[] = [];
    if (vocabNodes.length > 0) combined.push(vocabNodes[0]);
    grammarNodes.forEach((gn, i) => {
      combined.push(gn);
      if (i === 1 && vocabNodes.length > 1) combined.push(vocabNodes[1]);
      if (i === 3 && vocabNodes.length > 2) combined.push(vocabNodes[2]);
    });
    if (vocabNodes.length > 3) combined.push(vocabNodes[3]);

    // If no grammar, just vocab milestones
    if (grammarNodes.length === 0) {
      combined.push(...vocabNodes);
    }

    pathByLevel[level] = combined;
  }

  const completedTotal = Object.values(pathByLevel).flat().filter((n) => n.status === "completed").length;
  const totalNodes = Object.values(pathByLevel).flat().length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30">
            <Target size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("learningPath.title")}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {completedTotal}/{totalNodes} {t("learningPath.completed")}
            </p>
          </div>
        </div>
      </div>

      {/* Overall progress */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-700"
          style={{ width: `${totalNodes > 0 ? (completedTotal / totalNodes) * 100 : 0}%` }}
        />
      </div>

      {/* Level sections */}
      {LEVEL_ORDER.map((level) => {
        const nodes = pathByLevel[level] || [];
        if (nodes.length === 0) return null;
        const colors = LEVEL_COLORS[level] || LEVEL_COLORS.A1;
        const levelCompleted = nodes.filter((n) => n.status === "completed").length;
        const isCurrentLevel = level === userLevel;

        return (
          <div key={level} className="space-y-2">
            {/* Level header */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colors.bg} ${colors.text} ${colors.border} border`}>
                {level}
              </span>
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full ${colors.fill} rounded-full transition-all`} style={{ width: `${nodes.length > 0 ? (levelCompleted / nodes.length) * 100 : 0}%` }} />
              </div>
              <span className="text-xs text-gray-400">{levelCompleted}/{nodes.length}</span>
              {isCurrentLevel && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  {t("learningPath.currentLevel")}
                </span>
              )}
            </div>

            {/* Nodes */}
            <div className="space-y-1 ml-4">
              {nodes.map((node, idx) => {
                const StatusIcon = node.status === "completed" ? CheckCircle
                  : node.status === "locked" ? Lock : Circle;
                const statusColor = node.status === "completed" ? "text-emerald-500"
                  : node.status === "locked" ? "text-gray-300 dark:text-gray-600" : colors.text;

                return (
                  <div key={node.id} className="flex items-center gap-3">
                    {/* Connector line */}
                    <div className="relative flex flex-col items-center">
                      {idx > 0 && (
                        <div className={`absolute -top-2 w-0.5 h-2 ${node.status === "completed" ? "bg-emerald-300" : "bg-gray-200 dark:bg-gray-700"}`} />
                      )}
                      <StatusIcon size={18} className={statusColor} />
                    </div>

                    {/* Node content */}
                    <button
                      onClick={() => {
                        if (node.type === "grammar" && node.status !== "locked") {
                          navigate("/grammar");
                        } else if (node.type === "vocabulary") {
                          navigate("/learn");
                        }
                      }}
                      disabled={node.status === "locked"}
                      className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${
                        node.status === "locked"
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {node.type === "grammar" ? <BookOpen size={13} className="text-gray-400" /> : <Target size={13} className="text-gray-400" />}
                        <span className={`text-sm ${node.status === "completed" ? "text-gray-500 line-through" : "text-gray-700 dark:text-gray-300"}`}>
                          {node.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {node.score > 0 && node.status === "completed" && (
                          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{node.score}%</span>
                        )}
                        {node.status === "available" && <ChevronRight size={14} className="text-gray-400" />}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* CTA if no topics */}
      {totalNodes === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t("learningPath.noTopics")}</p>
          <button
            onClick={() => navigate("/settings")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <ArrowRight size={16} />
            {t("learningPath.importData")}
          </button>
        </div>
      )}
    </div>
  );
}
