import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Flame,
  Clock,
  BookOpen,
  Target,
  Repeat,
  MessageCircle,
  BookText,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import { CEFRBar } from "../components/ProgressBar";
import WordOfDay from "../components/WordOfDay";
import type { SrsStats, GrammarTopic } from "../types";

export default function Dashboard() {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();
  const [stats, setStats] = useState<SrsStats | null>(null);
  const [topics, setTopics] = useState<GrammarTopic[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [todayLearned, setTodayLearned] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePair) return;
    Promise.all([
      bridge.getSrsStats(activePair.id),
      bridge.getGrammarTopics(activePair.id),
      bridge.getDueCount(activePair.id),
    ])
      .then(([s, t, d]) => {
        setStats(s);
        setTopics(t);
        setDueCount(d);
      })
      .finally(() => setLoading(false));
    bridge.getDailyStats(activePair.id, 1).then(daily => {
      if (daily.length > 0) setTodayLearned(daily[0].words_learned);
    });
  }, [activePair]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  const streak = settings?.streak ?? 0;
  const accuracy = stats ? Math.round(stats.average_accuracy) : 0;
  const totalCards = stats?.total_cards ?? 0;

  const grammarByLevel = topics.reduce(
    (acc, t) => {
      acc[t.level] = acc[t.level] || { total: 0, done: 0 };
      acc[t.level].total++;
      if (t.completed) acc[t.level].done++;
      return acc;
    },
    {} as Record<string, { total: number; done: number }>,
  );

  const statCards = [
    {
      icon: Flame,
      label: t("dashboard.streak"),
      value: `${streak} ${streak !== 1 ? t("dashboard.days") : t("dashboard.day")}`,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-900/20",
      border: "border-orange-200 dark:border-orange-800",
    },
    {
      icon: Clock,
      label: t("dashboard.cardsDue"),
      value: String(dueCount),
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-200 dark:border-blue-800",
    },
    {
      icon: BookOpen,
      label: t("dashboard.wordsLearned"),
      value: String(totalCards),
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    {
      icon: Target,
      label: t("dashboard.accuracy"),
      value: `${accuracy}%`,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-900/20",
      border: "border-purple-200 dark:border-purple-800",
    },
  ];

  const quickActions = [
    ...(dueCount > 0
      ? [
          {
            icon: Repeat,
            title: t("dashboard.review"),
            description: dueCount !== 1 ? t("dashboard.cardsDueCount", { count: dueCount }) : t("dashboard.cardDue", { count: dueCount }),
            to: "/review",
            color: "text-amber-500",
            bg: "bg-amber-50 dark:bg-amber-900/20",
            border: "border-amber-200 dark:border-amber-800",
          },
        ]
      : []),
    {
      icon: BookOpen,
      title: t("dashboard.learn"),
      description: t("dashboard.discoverWords"),
      to: "/learn",
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    {
      icon: BookText,
      title: t("dashboard.grammar"),
      description: t("dashboard.exploreRules"),
      to: "/grammar",
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-200 dark:border-blue-800",
    },
    {
      icon: MessageCircle,
      title: t("dashboard.aiChat"),
      description: t("dashboard.practiceAi"),
      to: "/chat",
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-900/20",
      border: "border-purple-200 dark:border-purple-800",
    },
  ];

  const levelOrder = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const levelColors: Record<string, string> = {
    A1: "bg-emerald-500",
    A2: "bg-blue-500",
    B1: "bg-amber-500",
    B2: "bg-purple-500",
    C1: "bg-rose-500",
    C2: "bg-red-500",
  };

  interface Achievement {
    id: string;
    icon: string;
    label: string;
    unlocked: boolean;
  }

  const achievements: Achievement[] = [
    { id: "first_word", icon: "📖", label: t("achievements.firstWord"), unlocked: totalCards > 0 },
    { id: "ten_words", icon: "🌱", label: t("achievements.tenWords"), unlocked: totalCards >= 10 },
    { id: "fifty_words", icon: "🌿", label: t("achievements.fiftyWords"), unlocked: totalCards >= 50 },
    { id: "hundred_words", icon: "🌳", label: t("achievements.hundredWords"), unlocked: totalCards >= 100 },
    { id: "streak_7", icon: "🔥", label: t("achievements.streak7"), unlocked: streak >= 7 },
    { id: "streak_30", icon: "💪", label: t("achievements.streak30"), unlocked: streak >= 30 },
    { id: "accuracy_90", icon: "🎯", label: t("achievements.accuracy90"), unlocked: accuracy >= 90 },
    { id: "grammar_half", icon: "📚", label: t("achievements.grammarHalf"), unlocked: Object.values(grammarByLevel).reduce((s, l) => s + l.done, 0) > Object.values(grammarByLevel).reduce((s, l) => s + l.total, 0) / 2 },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t("dashboard.welcome")} <span className="inline-block animate-pulse">🔥</span>
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {activePair
            ? `${activePair.source_flag} ${activePair.source_name} → ${activePair.target_flag} ${activePair.target_name}`
            : t("dashboard.noActivePair")}
        </p>
      </div>

      {/* Word of the day */}
      <WordOfDay />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border ${card.border} ${card.bg} p-4 transition-shadow hover:shadow-md`}
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon size={18} className={card.color} />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {card.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Daily goal */}
      {settings && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t("dashboard.dailyGoal")}
            </h2>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
              {todayLearned} / {settings.words_per_day}
            </span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                todayLearned >= settings.words_per_day ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min((todayLearned / settings.words_per_day) * 100, 100)}%` }}
            />
          </div>
          {todayLearned >= settings.words_per_day && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
              {t("dashboard.goalReached")} 🎉
            </p>
          )}
        </div>
      )}

      {/* CEFR Level */}
      {settings?.level && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t("dashboard.cefrLevel")}
          </h2>
          <CEFRBar level={settings.level} />
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          {t("dashboard.quickActions")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              to={action.to}
              className={`group flex items-start gap-3 rounded-xl border ${action.border} ${action.bg} p-4 transition-all hover:shadow-md hover:scale-[1.02]`}
            >
              <div
                className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-gray-800 shadow-sm ${action.color}`}
              >
                <action.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                    {action.title}
                  </h3>
                  <ArrowRight
                    size={14}
                    className="text-gray-400 transition-transform group-hover:translate-x-1"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {action.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Grammar progress */}
      {Object.keys(grammarByLevel).length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t("dashboard.grammarProgress")}
            </h2>
            <Link
              to="/grammar"
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              {t("dashboard.seeAll")} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {levelOrder
              .filter((lvl) => grammarByLevel[lvl])
              .map((lvl) => {
                const { total, done } = grammarByLevel[lvl];
                const percent =
                  total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={lvl}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {lvl}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {done}/{total} ({percent}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${levelColors[lvl] || "bg-gray-400"}`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Achievements */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t("achievements.title")}
          </h2>
          <span className="text-xs text-gray-400">{unlockedCount}/{achievements.length}</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                a.unlocked ? "opacity-100" : "opacity-30 grayscale"
              }`}
              title={a.label}
            >
              <span className="text-2xl">{a.icon}</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight">{a.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
