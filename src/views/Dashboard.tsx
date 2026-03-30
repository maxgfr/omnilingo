import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Flame, Clock, BookOpen, Target, Repeat,
  MessageCircle, ArrowRight, Search, BookText,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import WordOfDay from "../components/WordOfDay";
import StreakCalendar from "../components/StreakCalendar";
import type { SrsStats } from "../types";

export default function Dashboard() {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();
  const [stats, setStats] = useState<SrsStats | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [todayLearned, setTodayLearned] = useState(0);
  const [calendarData, setCalendarData] = useState<Record<string, number>>({});
  const [totalWords, setTotalWords] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePair) return;
    Promise.all([
      bridge.getSrsStats(activePair.id),
      bridge.getDueCount(activePair.id),
      bridge.getWordCount(activePair.id),
    ])
      .then(([s, d, wc]) => {
        setStats(s);
        setDueCount(d);
        setTotalWords(wc);
      })
      .finally(() => setLoading(false));
    bridge.getDailyStats(activePair.id, 1).then(daily => {
      if (daily.length > 0) setTodayLearned(daily[0].words_learned);
    }).catch(() => {});
    bridge.getDailyStats(activePair.id, 365).then(stats => {
      const map: Record<string, number> = {};
      stats.forEach(s => { map[s.date] = s.words_learned + s.words_reviewed; });
      setCalendarData(map);
    }).catch(() => {});
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

  const statCards = [
    { icon: Flame, label: t("dashboard.streak"), value: `${streak}j`, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800" },
    { icon: Clock, label: t("dashboard.cardsDue"), value: String(dueCount), color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800" },
    { icon: BookOpen, label: t("dashboard.wordsLearned"), value: String(totalCards), color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800" },
    { icon: Target, label: t("dashboard.accuracy"), value: `${accuracy}%`, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800" },
  ];

  const quickActions = [
    { icon: BookOpen, title: t("dashboard.learn"), description: t("dashboard.discoverWords"), to: "/learn", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800" },
    ...(dueCount > 0 ? [{
      icon: Repeat, title: t("dashboard.review"),
      description: t("dashboard.cardsDueCount", { count: dueCount }),
      to: "/review", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800",
    }] : []),
    { icon: BookText, title: t("dashboard.grammar"), description: t("dashboard.exploreRules"), to: "/grammar", color: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-900/20", border: "border-teal-200 dark:border-teal-800" },
    { icon: Search, title: t("nav.dictionary"), description: `${totalWords} ${t("common.words").toLowerCase()}`, to: "/dictionary", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800" },
    { icon: MessageCircle, title: t("dashboard.aiChat"), description: t("dashboard.practiceAi"), to: "/chat", color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("dashboard.welcome")}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {activePair ? `${activePair.target_flag} ${activePair.target_name} → ${activePair.source_flag} ${activePair.source_name}` : t("dashboard.noActivePair")}
        </p>
      </div>

      {/* Empty state */}
      {totalWords === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30">
            <BookOpen size={32} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("dashboard.emptyTitle")}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">{t("dashboard.emptyDescription")}</p>
          </div>
          <Link to="/settings" className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium text-sm transition-all shadow-sm">
            <BookOpen size={16} />
            {t("dashboard.downloadDict")}
          </Link>
        </div>
      )}

      {/* Word of the day */}
      {totalCards > 0 && <WordOfDay />}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-xl border ${card.border} ${card.bg} p-4 transition-shadow hover:shadow-md`}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon size={18} className={card.color} />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Daily goal */}
      {settings && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t("dashboard.dailyGoal")}</h2>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{todayLearned} / {settings.words_per_day}</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${todayLearned >= settings.words_per_day ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${Math.min((todayLearned / settings.words_per_day) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Streak Calendar */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t("dashboard.streakCalendar")}</h2>
        <StreakCalendar data={calendarData} />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t("dashboard.quickActions")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.title} to={action.to} className={`group flex items-start gap-3 rounded-xl border ${action.border} ${action.bg} p-4 transition-all hover:shadow-md hover:scale-[1.02]`}>
              <div className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-gray-800 shadow-sm ${action.color}`}>
                <action.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{action.title}</h3>
                  <ArrowRight size={14} className="text-gray-400 transition-transform group-hover:translate-x-1" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
