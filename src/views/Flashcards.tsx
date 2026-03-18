import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Layers,
  Plus,
  Download,
  BookOpen,
  GraduationCap,
  Award,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import type { SrsCard } from "../types";

type Tab = "all" | "custom";

export default function Flashcards() {
  const { t } = useTranslation();
  const { activePair } = useApp();
  const [cards, setCards] = useState<SrsCard[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadCards = useCallback(async () => {
    if (!activePair) return;
    setLoading(true);
    try {
      const dueCards = await bridge.getDueCards(activePair.id);
      setCards(dueCards);
    } catch (err) {
      console.error("Failed to load cards:", err);
    } finally {
      setLoading(false);
    }
  }, [activePair]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Group cards by status
  const newCards = cards.filter(
    (c) => c.ease_factor === 2.5 && c.repetitions === 0,
  );
  const learningCards = cards.filter(
    (c) => !(c.ease_factor === 2.5 && c.repetitions === 0) && c.repetitions < 5,
  );
  const masteredCards = cards.filter((c) => c.repetitions >= 5);

  const handleCreate = async () => {
    if (!activePair || !front.trim() || !back.trim()) return;
    setCreating(true);
    setCreated(false);
    try {
      const wordId = await bridge.addCustomWord(
        activePair.id,
        front.trim(),
        back.trim(),
      );
      await bridge.addWordToSrs(wordId);
      setFront("");
      setBack("");
      setCreated(true);
      setTimeout(() => setCreated(false), 2000);
      await loadCards();
    } catch (err) {
      console.error("Failed to create flashcard:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleExport = async () => {
    if (!activePair) return;
    setExporting(true);
    try {
      const data = await bridge.exportProgress(activePair.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flashcards-${activePair.source_lang}-${activePair.target_lang}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export:", err);
    } finally {
      setExporting(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t("flashcards.allCards") },
    { key: "custom", label: t("flashcards.custom") },
  ];

  const groups = [
    {
      key: "new",
      label: t("flashcards.new"),
      cards: newCards,
      icon: BookOpen,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
      border: "border-blue-200 dark:border-blue-800",
    },
    {
      key: "learning",
      label: t("flashcards.learning"),
      cards: learningCards,
      icon: GraduationCap,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
      border: "border-amber-200 dark:border-amber-800",
    },
    {
      key: "mastered",
      label: t("flashcards.mastered"),
      cards: masteredCards,
      icon: Award,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      border: "border-emerald-200 dark:border-emerald-800",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
            <Layers size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t("flashcards.title")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {cards.length} {t("common.words").toLowerCase()}
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || cards.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {t("flashcards.export")}
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === item.key
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">{t("common.loading")}</p>
          </div>
        </div>
      ) : tab === "all" ? (
        /* All Cards tab */
        <div>
          {cards.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
                <Layers size={32} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                {t("flashcards.noCards")}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                {groups.map((group) => (
                  <div
                    key={group.key}
                    className={`rounded-xl border ${group.border} ${group.bg} p-4 text-center`}
                  >
                    <group.icon size={24} className={`mx-auto mb-2 ${group.color}`} />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {group.cards.length}
                    </p>
                    <p className={`text-xs font-medium mt-1 ${group.color}`}>
                      {group.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Card lists per group */}
              {groups.map((group) =>
                group.cards.length > 0 ? (
                  <div key={group.key}>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      <group.icon size={16} className={group.color} />
                      {group.label}
                      <span className="text-gray-400 dark:text-gray-500 font-normal">
                        ({group.cards.length})
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {group.cards.slice(0, 10).map((card) => (
                        <div
                          key={card.id}
                          className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {card.source_word}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {card.target_word}
                            </p>
                          </div>
                          <div className="flex-shrink-0 ml-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${group.bg} ${group.color}`}>
                              {card.repetitions}x
                            </span>
                          </div>
                        </div>
                      ))}
                      {group.cards.length > 10 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 col-span-full text-center py-2">
                          +{group.cards.length - 10} more
                        </p>
                      )}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          )}
        </div>
      ) : (
        /* Custom tab */
        <div>
          {/* Add flashcard form */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 mb-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-4">
              <Plus size={18} className="text-indigo-500" />
              {t("flashcards.create")}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  {t("flashcards.front")}
                </label>
                <input
                  type="text"
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder={activePair?.source_name || ""}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  {t("flashcards.back")}
                </label>
                <input
                  type="text"
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && front.trim() && back.trim()) {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder={activePair?.target_name || ""}
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || !front.trim() || !back.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              >
                {creating ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : created ? (
                  <>
                    <CheckCircle2 size={18} />
                    {t("flashcards.created")}
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    {t("flashcards.create")}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Custom cards list (all cards shown since they may all be custom) */}
          {cards.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
                <Plus size={32} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                {t("flashcards.noCards")}
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {t("flashcards.allCards")} ({cards.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {card.source_word}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {card.target_word}
                      </p>
                    </div>
                    <div className="flex-shrink-0 ml-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          card.repetitions >= 5
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                            : card.repetitions > 0
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {card.repetitions}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
