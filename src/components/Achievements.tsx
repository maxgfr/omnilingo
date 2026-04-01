import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Trophy, Flame, BookOpen, Target,
  Star, Zap, Calendar, Brain,
  MessageCircle, GraduationCap,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import type { OverviewStats } from "../types";

interface Achievement {
  id: string;
  icon: typeof Trophy;
  titleKey: string;
  descKey: string;
  threshold: number;
  getValue: (stats: OverviewStats) => number;
  color: string;
  bgColor: string;
}

const ACHIEVEMENTS: Achievement[] = [
  // Vocabulary milestones
  { id: "words_10", icon: BookOpen, titleKey: "achievements.firstSteps", descKey: "achievements.firstStepsDesc", threshold: 10, getValue: (s) => s.total_learned, color: "text-emerald-500", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  { id: "words_50", icon: BookOpen, titleKey: "achievements.wordCollector", descKey: "achievements.wordCollectorDesc", threshold: 50, getValue: (s) => s.total_learned, color: "text-emerald-500", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  { id: "words_100", icon: BookOpen, titleKey: "achievements.centurion", descKey: "achievements.centurionDesc", threshold: 100, getValue: (s) => s.total_learned, color: "text-emerald-500", bgColor: "bg-emerald-100 dark:bg-emerald-900/30" },
  { id: "words_500", icon: Star, titleKey: "achievements.polyglot", descKey: "achievements.polyglotDesc", threshold: 500, getValue: (s) => s.total_learned, color: "text-amber-500", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  { id: "words_1000", icon: GraduationCap, titleKey: "achievements.scholar", descKey: "achievements.scholarDesc", threshold: 1000, getValue: (s) => s.total_learned, color: "text-purple-500", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  // Streak milestones
  { id: "streak_3", icon: Flame, titleKey: "achievements.onFire", descKey: "achievements.onFireDesc", threshold: 3, getValue: (s) => s.streak, color: "text-orange-500", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  { id: "streak_7", icon: Flame, titleKey: "achievements.weekWarrior", descKey: "achievements.weekWarriorDesc", threshold: 7, getValue: (s) => s.streak, color: "text-orange-500", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  { id: "streak_30", icon: Flame, titleKey: "achievements.monthlyMaster", descKey: "achievements.monthlyMasterDesc", threshold: 30, getValue: (s) => s.streak, color: "text-orange-500", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  // Review milestones
  { id: "reviews_50", icon: Target, titleKey: "achievements.reviewer", descKey: "achievements.reviewerDesc", threshold: 50, getValue: (s) => s.total_reviews, color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  { id: "reviews_500", icon: Target, titleKey: "achievements.practiceChampion", descKey: "achievements.practiceChampionDesc", threshold: 500, getValue: (s) => s.total_reviews, color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  // Accuracy milestones
  { id: "accuracy_80", icon: Zap, titleKey: "achievements.sharpMind", descKey: "achievements.sharpMindDesc", threshold: 80, getValue: (s) => s.accuracy, color: "text-indigo-500", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  { id: "accuracy_95", icon: Brain, titleKey: "achievements.perfectionist", descKey: "achievements.perfectionistDesc", threshold: 95, getValue: (s) => s.accuracy, color: "text-indigo-500", bgColor: "bg-indigo-100 dark:bg-indigo-900/30" },
  // Study days
  { id: "days_7", icon: Calendar, titleKey: "achievements.dedicated", descKey: "achievements.dedicatedDesc", threshold: 7, getValue: (s) => s.study_days, color: "text-teal-500", bgColor: "bg-teal-100 dark:bg-teal-900/30" },
  { id: "days_30", icon: Calendar, titleKey: "achievements.committed", descKey: "achievements.committedDesc", threshold: 30, getValue: (s) => s.study_days, color: "text-teal-500", bgColor: "bg-teal-100 dark:bg-teal-900/30" },
  { id: "days_100", icon: Trophy, titleKey: "achievements.veteran", descKey: "achievements.veteranDesc", threshold: 100, getValue: (s) => s.study_days, color: "text-amber-500", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  // Grammar
  { id: "grammar_5", icon: MessageCircle, titleKey: "achievements.grammarian", descKey: "achievements.grammarianDesc", threshold: 5, getValue: (s) => s.total_grammar_completed, color: "text-rose-500", bgColor: "bg-rose-100 dark:bg-rose-900/30" },
];

export default function Achievements() {
  const { t } = useTranslation();
  const { activePair } = useApp();
  const [stats, setStats] = useState<OverviewStats | null>(null);

  useEffect(() => {
    if (!activePair) return;
    bridge.getOverviewStats(activePair.id).then(setStats).catch(() => {});
  }, [activePair]);

  if (!stats) return null;

  const unlocked = ACHIEVEMENTS.filter((a) => a.getValue(stats) >= a.threshold);
  const locked = ACHIEVEMENTS.filter((a) => a.getValue(stats) < a.threshold);
  // Next achievement to unlock
  const nextUp = locked.length > 0
    ? locked.reduce((best, a) => {
        const progress = a.getValue(stats) / a.threshold;
        const bestProgress = best.getValue(stats) / best.threshold;
        return progress > bestProgress ? a : best;
      })
    : null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30">
          <Trophy size={20} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t("achievements.title")}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {unlocked.length}/{ACHIEVEMENTS.length} {t("achievements.unlocked")}
          </p>
        </div>
      </div>

      {/* Next achievement */}
      {nextUp && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
            {t("achievements.nextUp")}
          </p>
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${nextUp.bgColor}`}>
              <nextUp.icon size={20} className={nextUp.color} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{t(nextUp.titleKey)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t(nextUp.descKey)}</p>
              <div className="mt-1.5 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min((nextUp.getValue(stats) / nextUp.threshold) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {nextUp.getValue(stats)}/{nextUp.threshold}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {unlocked.map((a) => (
            <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${a.bgColor} border-transparent`}>
              <a.icon size={20} className={a.color} />
              <div>
                <p className="text-xs font-semibold text-gray-900 dark:text-white">{t(a.titleKey)}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t(a.descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Locked (dimmed) */}
      {locked.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {locked.map((a) => {
            const progress = Math.round((a.getValue(stats) / a.threshold) * 100);
            return (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 opacity-40">
                <a.icon size={20} className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{t(a.titleKey)}</p>
                  <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-400 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
