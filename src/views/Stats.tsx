import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  BookOpen,
  Target,
  Calendar,
  Star,
  AlertTriangle,
  TrendingUp,
  Award,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import type { DailyStatRow, OverviewStats } from "../types";

export default function Stats() {
  const { t } = useTranslation();
  const { activePair } = useApp();
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [daily, setDaily] = useState<DailyStatRow[]>([]);
  const [errors, setErrors] = useState<
    Array<{ word: string; type: string; count: number; correct: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePair) return;
    setLoading(true);
    Promise.all([
      bridge.getOverviewStats(activePair.id),
      bridge.getDailyStats(activePair.id, 30),
      bridge.getFrequentErrors(activePair.id, 15),
    ])
      .then(([o, d, e]) => {
        setOverview(o);
        setDaily(d);
        setErrors(e);
      })
      .finally(() => setLoading(false));
  }, [activePair]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">{t("stats.noData")}</p>
      </div>
    );
  }

  // --- Overview cards ---
  const overviewCards = [
    {
      icon: BookOpen,
      label: t("stats.totalWords"),
      value: overview.total_words,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-200 dark:border-blue-800",
    },
    {
      icon: TrendingUp,
      label: t("stats.wordsLearned"),
      value: overview.total_learned,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    {
      icon: Target,
      label: t("stats.reviewsDone"),
      value: overview.total_reviews,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-900/20",
      border: "border-purple-200 dark:border-purple-800",
    },
    {
      icon: Award,
      label: t("stats.grammarCompleted"),
      value: `${overview.total_grammar_completed}/${overview.total_grammar}`,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-200 dark:border-amber-800",
    },
    {
      icon: Calendar,
      label: t("stats.studyDays"),
      value: overview.study_days,
      color: "text-rose-500",
      bg: "bg-rose-50 dark:bg-rose-900/20",
      border: "border-rose-200 dark:border-rose-800",
    },
    {
      icon: Star,
      label: t("stats.favorites"),
      value: overview.favorite_count,
      color: "text-yellow-500",
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
      border: "border-yellow-200 dark:border-yellow-800",
    },
  ];

  // --- Activity chart data ---
  const maxBarHeight = 120; // px
  const maxValue = daily.reduce(
    (max, d) => Math.max(max, d.words_learned + d.words_reviewed),
    0,
  );

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function getDayLabel(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    return dayLabels[date.getDay()];
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    return `${date.getDate()}/${date.getMonth() + 1}`;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 size={24} className="text-amber-500" />
          {t("stats.title")}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("stats.subtitle")}
        </p>
      </div>

      {/* Overview grid — 3x2 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {overviewCards.map((card) => (
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

      {/* Accuracy badge */}
      {overview.accuracy > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Target size={24} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t("stats.overallAccuracy")}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(overview.accuracy)}%
            </p>
          </div>
        </div>
      )}

      {/* Activity chart — last 30 days */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <BarChart3 size={16} className="text-amber-500" />
            {t("stats.activityChart")}
          </h2>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span className="text-gray-500 dark:text-gray-400">
                {t("stats.learned")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-gray-500 dark:text-gray-400">
                {t("stats.reviewed")}
              </span>
            </div>
          </div>
        </div>

        {daily.length === 0 || maxValue === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
            <Calendar size={32} className="mb-2 opacity-50" />
            <p className="text-sm">{t("stats.noActivity")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="flex items-end gap-[2px] min-w-fit"
              style={{ height: `${maxBarHeight + 40}px` }}
            >
              {daily.map((day, i) => {
                const total = day.words_learned + day.words_reviewed;
                const totalHeight =
                  maxValue > 0
                    ? Math.max((total / maxValue) * maxBarHeight, total > 0 ? 4 : 0)
                    : 0;
                const learnedHeight =
                  total > 0
                    ? (day.words_learned / total) * totalHeight
                    : 0;
                const reviewedHeight = totalHeight - learnedHeight;

                return (
                  <div
                    key={day.date}
                    className="flex flex-col items-center group relative"
                    style={{ width: "8px" }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                      <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                        <p className="font-semibold">{formatDate(day.date)}</p>
                        <p>
                          {t("stats.learned")}: {day.words_learned}
                        </p>
                        <p>
                          {t("stats.reviewed")}: {day.words_reviewed}
                        </p>
                      </div>
                    </div>

                    {/* Stacked bar */}
                    <div
                      className="w-full flex flex-col justify-end rounded-t-sm overflow-hidden"
                      style={{ height: `${maxBarHeight}px` }}
                    >
                      {reviewedHeight > 0 && (
                        <div
                          className="w-full bg-blue-500 rounded-t-sm transition-all duration-300"
                          style={{ height: `${reviewedHeight}px` }}
                        />
                      )}
                      {learnedHeight > 0 && (
                        <div
                          className="w-full bg-emerald-500 transition-all duration-300"
                          style={{
                            height: `${learnedHeight}px`,
                            borderRadius:
                              reviewedHeight > 0 ? "0" : "2px 2px 0 0",
                          }}
                        />
                      )}
                    </div>

                    {/* Day label — show every 7th day or Mon */}
                    {(i % 7 === 0 || getDayLabel(day.date) === "Mon") && (
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 leading-none">
                        {getDayLabel(day.date)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Frequent errors */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="text-rose-500" />
          {t("stats.frequentErrors")}
        </h2>

        {errors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
            <AlertTriangle size={28} className="mb-2 opacity-50" />
            <p className="text-sm">{t("stats.noErrors")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((err, i) => (
              <div
                key={`${err.word}-${i}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {err.word}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {err.type}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {err.correct}
                  </span>
                  <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
                    {err.count}x
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
