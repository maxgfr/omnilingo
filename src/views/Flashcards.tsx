import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Layers,
  Plus,
  BookOpen,
  GraduationCap,
  Award,
  Loader2,
  CheckCircle2,
  Play,
  RotateCcw,
  Trash2,
  FolderOpen,
  Trophy,
  Target,
  Zap,
  ChevronRight,
  X,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { useFeaturePair } from "../lib/useFeaturePair";
import LanguagePairBar from "../components/LanguagePairBar";
import * as bridge from "../lib/bridge";
import type { SrsCard, SrsStats } from "../types";

type Tab = "review" | "all" | "create" | "decks";
type CardType = "translation" | "reverse" | "cloze";

interface SessionResult {
  cardId: number;
  quality: number;
  sourceWord: string;
  targetWord: string;
}

export default function Flashcards() {
  const { t } = useTranslation();
  const { languagePairs } = useApp();
  const { activePair, switchPair } = useFeaturePair("flashcards");

  // Tab state
  const [tab, setTab] = useState<Tab>("review");
  const [loading, setLoading] = useState(true);

  // Card data
  const [dueCards, setDueCards] = useState<SrsCard[]>([]);
  const [allCards, setAllCards] = useState<SrsCard[]>([]);
  const [stats, setStats] = useState<SrsStats | null>(null);

  // Review session
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionCards, setSessionCards] = useState<SrsCard[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Create form
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [cardType, setCardType] = useState<CardType>("translation");
  const [deckName, setDeckName] = useState("");
  const [clozeSentence, setClozeSentence] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  // Decks
  const [activeDeckFilter, setActiveDeckFilter] = useState<string | null>(null);

  // Delete confirmation
  const [deletingCardId, setDeletingCardId] = useState<number | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    if (!activePair) return;
    try {
      const s = await bridge.getSrsStats(activePair.id);
      setStats(s);
    } catch (err) {
      console.error("Failed to load SRS stats:", err);
    }
  }, [activePair]);

  const loadDueCards = useCallback(async () => {
    if (!activePair) return;
    try {
      const cards = await bridge.getDueCards(activePair.id);
      setDueCards(cards);
    } catch (err) {
      console.error("Failed to load due cards:", err);
    }
  }, [activePair]);

  const loadAllCards = useCallback(async () => {
    if (!activePair) return;
    try {
      const cards = await bridge.getAllSrsCards(
        activePair.id,
        activeDeckFilter ?? undefined,
      );
      setAllCards(cards);
    } catch (err) {
      console.error("Failed to load all cards:", err);
    }
  }, [activePair, activeDeckFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadDueCards(), loadAllCards()]);
    setLoading(false);
  }, [loadStats, loadDueCards, loadAllCards]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload all cards when deck filter changes
  useEffect(() => {
    if (!loading) {
      loadAllCards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDeckFilter]);

  // ── Derived data ─────────────────────────────────────────────────────

  const decks = useMemo(() => {
    const deckMap = new Map<string, number>();
    allCards.forEach((card) => {
      const d = card.deck || "default";
      deckMap.set(d, (deckMap.get(d) || 0) + 1);
    });
    return Array.from(deckMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCards]);

  // Group all cards by status
  const newCards = allCards.filter(
    (c) => c.ease_factor === 2.5 && c.repetitions === 0,
  );
  const learningCards = allCards.filter(
    (c) =>
      !(c.ease_factor === 2.5 && c.repetitions === 0) && c.repetitions < 5,
  );
  const masteredCards = allCards.filter((c) => c.repetitions >= 5);

  // ── Review session ───────────────────────────────────────────────────

  const startSession = () => {
    if (dueCards.length === 0) return;
    // Shuffle the due cards
    const shuffled = [...dueCards].sort(() => Math.random() - 0.5);
    setSessionCards(shuffled);
    setSessionIndex(0);
    setFlipped(false);
    setSessionResults([]);
    setSessionComplete(false);
    setSessionActive(true);
  };

  const currentCard = sessionActive ? sessionCards[sessionIndex] : null;

  const handleRate = async (quality: number) => {
    if (!currentCard || reviewLoading) return;
    setReviewLoading(true);

    try {
      await bridge.reviewCard(currentCard.id, quality);
      setSessionResults((prev) => [
        ...prev,
        {
          cardId: currentCard.id,
          quality,
          sourceWord: currentCard.source_word,
          targetWord: currentCard.target_word,
        },
      ]);

      const nextIndex = sessionIndex + 1;
      if (nextIndex >= sessionCards.length) {
        setSessionComplete(true);
      } else {
        setSessionIndex(nextIndex);
        setFlipped(false);
      }
    } catch (err) {
      console.error("Failed to review card:", err);
    } finally {
      setReviewLoading(false);
    }
  };

  const endSession = async () => {
    setSessionActive(false);
    setSessionComplete(false);
    setSessionCards([]);
    setSessionIndex(0);
    setSessionResults([]);
    setFlipped(false);
    // Reload data after session
    await loadData();
  };

  // Session accuracy
  const sessionAccuracy =
    sessionResults.length > 0
      ? Math.round(
          (sessionResults.filter((r) => r.quality >= 3).length /
            sessionResults.length) *
            100,
        )
      : 0;

  // ── Card front/back rendering by type ────────────────────────────────

  const renderCardFront = (card: SrsCard) => {
    const type = card.card_type || "translation";
    switch (type) {
      case "reverse":
        return (
          <div className="text-center">
            <p className="text-xs font-medium text-indigo-400 dark:text-indigo-300 mb-3 uppercase tracking-wider">
              {t("flashcards.reverse", "Reverse")}
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {card.target_word}
            </p>
            {card.gender && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                ({card.gender})
              </p>
            )}
          </div>
        );
      case "cloze":
        return (
          <div className="text-center">
            <p className="text-xs font-medium text-indigo-400 dark:text-indigo-300 mb-3 uppercase tracking-wider">
              {t("flashcards.cloze", "Cloze")}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white leading-relaxed">
              {card.cloze_sentence
                ? card.cloze_sentence.replace(
                    /\{\{.*?\}\}/g,
                    "______",
                  )
                : `______ (${card.source_word})`}
            </p>
          </div>
        );
      default:
        // translation
        return (
          <div className="text-center">
            <p className="text-xs font-medium text-indigo-400 dark:text-indigo-300 mb-3 uppercase tracking-wider">
              {t("flashcards.translate", "Translation")}
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {card.source_word}
            </p>
          </div>
        );
    }
  };

  const renderCardBack = (card: SrsCard) => {
    const type = card.card_type || "translation";
    switch (type) {
      case "reverse":
        return (
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {card.source_word}
            </p>
            {card.example_source && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 italic">
                {card.example_source}
              </p>
            )}
          </div>
        );
      case "cloze":
        return (
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {card.target_word}
            </p>
            {card.cloze_sentence && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 italic">
                {card.cloze_sentence.replace(
                  /\{\{(.*?)\}\}/g,
                  (_match, word: string) => word,
                )}
              </p>
            )}
          </div>
        );
      default:
        return (
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {card.target_word}
            </p>
            {card.gender && (
              <p className="text-lg text-indigo-500 dark:text-indigo-400 mt-1 font-medium">
                {card.gender}
              </p>
            )}
            {card.example_target && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 italic">
                {card.example_target}
              </p>
            )}
          </div>
        );
    }
  };

  // ── Create card ──────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!activePair || !front.trim() || !back.trim()) return;
    if (cardType === "cloze" && !clozeSentence.trim()) return;
    setCreating(true);
    setCreated(false);
    try {
      const wordId = await bridge.addCustomWord(
        activePair.id,
        front.trim(),
        back.trim(),
      );
      await bridge.addWordToSrs(
        wordId,
        cardType,
        deckName.trim() || undefined,
        cardType === "cloze" ? clozeSentence.trim() : undefined,
      );
      setFront("");
      setBack("");
      setClozeSentence("");
      setCreated(true);
      setTimeout(() => setCreated(false), 2000);
      await loadData();
    } catch (err) {
      console.error("Failed to create flashcard:", err);
    } finally {
      setCreating(false);
    }
  };

  // ── Delete card ──────────────────────────────────────────────────────

  const handleDelete = async (cardId: number) => {
    try {
      await bridge.deleteSrsCard(cardId);
      setDeletingCardId(null);
      await loadData();
    } catch (err) {
      console.error("Failed to delete card:", err);
    }
  };

  // ── Rating buttons config ───────────────────────────────────────────

  const ratingButtons = [
    {
      quality: 0,
      label: t("flashcards.forgot", "Oubli\u00e9"),
      color:
        "bg-red-500 hover:bg-red-600 active:bg-red-700",
      icon: X,
    },
    {
      quality: 2,
      label: t("flashcards.hard", "Difficile"),
      color:
        "bg-orange-500 hover:bg-orange-600 active:bg-orange-700",
      icon: Target,
    },
    {
      quality: 3,
      label: t("flashcards.good", "Bien"),
      color:
        "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700",
      icon: CheckCircle2,
    },
    {
      quality: 5,
      label: t("flashcards.easy", "Facile"),
      color:
        "bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700",
      icon: Zap,
    },
  ];

  // ── Tab config ───────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    {
      key: "review",
      label: t("flashcards.review", "R\u00e9vision"),
      icon: Play,
    },
    {
      key: "all",
      label: t("flashcards.allCards"),
      icon: Layers,
    },
    {
      key: "create",
      label: t("flashcards.create"),
      icon: Plus,
    },
    {
      key: "decks",
      label: t("flashcards.decks", "Paquets"),
      icon: FolderOpen,
    },
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

  // ── Render ───────────────────────────────────────────────────────────

  // If a review session is active, render the session UI full-screen-like
  if (sessionActive) {
    // Session complete summary
    if (sessionComplete) {
      const correctCount = sessionResults.filter(
        (r) => r.quality >= 3,
      ).length;
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-md">
            {/* Trophy */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <Trophy
                  size={40}
                  className="text-indigo-600 dark:text-indigo-400"
                />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
              {t("flashcards.sessionComplete", "Session termin\u00e9e !")}
            </h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
              {t(
                "flashcards.sessionSummary",
                "Voici votre r\u00e9sum\u00e9 de session",
              )}
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {sessionResults.length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t("flashcards.reviewed", "R\u00e9vis\u00e9es")}
                </p>
              </div>
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {correctCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t("flashcards.correct", "Correctes")}
                </p>
              </div>
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {sessionAccuracy}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t("flashcards.accuracy", "Pr\u00e9cision")}
                </p>
              </div>
            </div>

            {/* Results list */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden mb-6">
              <div className="max-h-64 overflow-y-auto">
                {sessionResults.map((result, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-4 py-3 ${
                      i > 0
                        ? "border-t border-gray-100 dark:border-gray-700/50"
                        : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {result.sourceWord}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {result.targetWord}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        result.quality >= 3
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          : result.quality >= 2
                            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                            : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {result.quality >= 3
                        ? t("flashcards.good", "Bien")
                        : result.quality >= 2
                          ? t("flashcards.hard", "Difficile")
                          : t("flashcards.forgot", "Oubli\u00e9")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={endSession}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {t("flashcards.backToCards", "Retour")}
              </button>
              <button
                onClick={async () => {
                  await endSession();
                  // Small delay to let state reset, then start new session
                  setTimeout(() => {
                    startSession();
                  }, 100);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm transition-colors"
              >
                <RotateCcw size={16} />
                {t("flashcards.reviewAgain", "Recommencer")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Active review card
    return (
      <div className="flex flex-col items-center min-h-[60vh]">
        {/* Session header */}
        <div className="w-full max-w-lg mb-6">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={endSession}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <X size={16} />
              {t("flashcards.endSession", "Terminer")}
            </button>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {sessionIndex + 1} / {sessionCards.length}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{
                width: `${((sessionIndex + 1) / sessionCards.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Flip card */}
        {currentCard && (
          <div className="w-full max-w-lg">
            <div
              className="perspective-1000 w-full cursor-pointer"
              onClick={() => !flipped && setFlipped(true)}
            >
              <div
                className={`relative w-full transform-3d transition-transform duration-500 ${
                  flipped ? "rotate-y-180" : ""
                }`}
                style={{ minHeight: "280px" }}
              >
                {/* Front face */}
                <div className="absolute inset-0 backface-hidden rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 shadow-lg flex flex-col items-center justify-center p-8">
                  {renderCardFront(currentCard)}
                  <p className="absolute bottom-4 text-xs text-gray-400 dark:text-gray-500">
                    {t(
                      "flashcards.tapToFlip",
                      "Cliquez pour r\u00e9v\u00e9ler",
                    )}
                  </p>
                </div>

                {/* Back face */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 shadow-lg flex flex-col items-center justify-center p-8">
                  {renderCardBack(currentCard)}
                </div>
              </div>
            </div>

            {/* Rating buttons - only visible after flip */}
            {flipped && (
              <div className="mt-6 grid grid-cols-4 gap-2">
                {ratingButtons.map((btn) => (
                  <button
                    key={btn.quality}
                    onClick={() => handleRate(btn.quality)}
                    disabled={reviewLoading}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${btn.color}`}
                  >
                    {reviewLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <btn.icon size={18} />
                    )}
                    <span className="text-xs">{btn.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Main view (not in session) ───────────────────────────────────────

  return (
    <div>
      <LanguagePairBar pairs={languagePairs} activePairId={activePair?.id ?? null} onSwitch={switchPair} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
            <Layers
              size={20}
              className="text-indigo-600 dark:text-indigo-400"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t("flashcards.title")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stats
                ? `${stats.total_cards} ${t("common.words").toLowerCase()}`
                : t("common.loading")}
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === item.key
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">{t("common.loading")}</p>
          </div>
        </div>
      ) : (
        <>
          {/* ──────────── TAB: Review ──────────── */}
          {tab === "review" && (
            <div>
              {/* Stats overview */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4 text-center">
                  <Target
                    size={24}
                    className="mx-auto mb-2 text-indigo-600 dark:text-indigo-400"
                  />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {dueCards.length}
                  </p>
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                    {t("flashcards.due", "\u00c0 r\u00e9viser")}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center">
                  <Layers
                    size={24}
                    className="mx-auto mb-2 text-gray-500 dark:text-gray-400"
                  />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats?.total_cards ?? 0}
                  </p>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
                    {t("flashcards.totalCards", "Total")}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-center">
                  <Trophy
                    size={24}
                    className="mx-auto mb-2 text-emerald-600 dark:text-emerald-400"
                  />
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats ? Math.round(stats.average_accuracy * 100) : 0}%
                  </p>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                    {t("flashcards.accuracy", "Pr\u00e9cision")}
                  </p>
                </div>
              </div>

              {/* Start button or empty state */}
              {dueCards.length > 0 ? (
                <button
                  onClick={startSession}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-bold text-lg transition-colors shadow-lg shadow-indigo-500/20"
                >
                  <Play size={22} />
                  {t("flashcards.startReview", "Commencer la r\u00e9vision")}
                  <span className="ml-1 px-2.5 py-0.5 rounded-full bg-white/20 text-sm font-semibold">
                    {dueCards.length}
                  </span>
                </button>
              ) : (
                <div className="text-center py-16 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                    <CheckCircle2
                      size={32}
                      className="text-emerald-500 dark:text-emerald-400"
                    />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {t(
                      "flashcards.allDone",
                      "Tout est r\u00e9vis\u00e9 !",
                    )}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t(
                      "flashcards.noDueCards",
                      "Aucune carte \u00e0 r\u00e9viser pour le moment.",
                    )}
                  </p>
                </div>
              )}

              {/* Preview of upcoming cards */}
              {dueCards.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    {t(
                      "flashcards.upcomingCards",
                      "Cartes \u00e0 r\u00e9viser",
                    )}
                  </h3>
                  <div className="space-y-2">
                    {dueCards.slice(0, 5).map((card) => (
                      <div
                        key={card.id}
                        className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {card.source_word}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">
                            {card.card_type || "translation"}
                          </span>
                          <ChevronRight
                            size={14}
                            className="text-gray-400 dark:text-gray-500"
                          />
                        </div>
                      </div>
                    ))}
                    {dueCards.length > 5 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">
                        +{dueCards.length - 5}{" "}
                        {t("flashcards.moreCards", "autres cartes")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ──────────── TAB: All Cards ──────────── */}
          {tab === "all" && (
            <div>
              {/* Deck filter indicator */}
              {activeDeckFilter && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                  <FolderOpen
                    size={14}
                    className="text-indigo-500 dark:text-indigo-400"
                  />
                  <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                    {activeDeckFilter}
                  </span>
                  <button
                    onClick={() => setActiveDeckFilter(null)}
                    className="ml-auto text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {allCards.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
                    <Layers
                      size={32}
                      className="text-gray-400 dark:text-gray-500"
                    />
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
                        <group.icon
                          size={24}
                          className={`mx-auto mb-2 ${group.color}`}
                        />
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {group.cards.length}
                        </p>
                        <p
                          className={`text-xs font-medium mt-1 ${group.color}`}
                        >
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
                          {group.cards.map((card) => (
                            <div
                              key={card.id}
                              className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 hover:shadow-sm transition-shadow group/card"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {card.source_word}
                                  </p>
                                  {card.card_type &&
                                    card.card_type !== "translation" && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">
                                        {card.card_type}
                                      </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {card.target_word}
                                  {card.deck &&
                                    card.deck !== "default" && (
                                      <span className="ml-2 text-gray-400 dark:text-gray-500">
                                        [{card.deck}]
                                      </span>
                                    )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${group.bg} ${group.color}`}
                                >
                                  {card.repetitions}x
                                </span>
                                {deletingCardId === card.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDelete(card.id)}
                                      className="p-1 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                      title={t("common.confirm")}
                                    >
                                      <CheckCircle2 size={14} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setDeletingCardId(null)
                                      }
                                      className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setDeletingCardId(card.id)
                                    }
                                    className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover/card:opacity-100 transition-all"
                                    title={t("common.delete")}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          )}

          {/* ──────────── TAB: Create ──────────── */}
          {tab === "create" && (
            <div className="max-w-lg mx-auto">
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-5">
                  <Plus size={18} className="text-indigo-500" />
                  {t("flashcards.create")}
                </h3>

                <div className="space-y-4">
                  {/* Card type selector */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      {t("flashcards.cardType", "Type de carte")}
                    </label>
                    <div className="flex gap-2">
                      {(
                        [
                          {
                            type: "translation" as CardType,
                            label: t(
                              "flashcards.translation",
                              "Traduction",
                            ),
                          },
                          {
                            type: "reverse" as CardType,
                            label: t("flashcards.reverse", "Inverse"),
                          },
                          {
                            type: "cloze" as CardType,
                            label: t(
                              "flashcards.cloze",
                              "Texte \u00e0 trous",
                            ),
                          },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.type}
                          onClick={() => setCardType(item.type)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                            cardType === item.type
                              ? "bg-indigo-500 border-indigo-500 text-white"
                              : "bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-700"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Front */}
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

                  {/* Back */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      {t("flashcards.back")}
                    </label>
                    <input
                      type="text"
                      value={back}
                      onChange={(e) => setBack(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                      placeholder={activePair?.target_name || ""}
                    />
                  </div>

                  {/* Cloze sentence (only for cloze type) */}
                  {cardType === "cloze" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                        {t(
                          "flashcards.clozeSentence",
                          "Phrase \u00e0 trous",
                        )}
                      </label>
                      <input
                        type="text"
                        value={clozeSentence}
                        onChange={(e) => setClozeSentence(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                        placeholder="Ich {{gehe}} in die Schule."
                      />
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                        {t(
                          "flashcards.clozeHint",
                          "Utilisez {{mot}} pour indiquer le trou.",
                        )}
                      </p>
                    </div>
                  )}

                  {/* Deck name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      {t("flashcards.deckName", "Paquet")}
                    </label>
                    <input
                      type="text"
                      value={deckName}
                      onChange={(e) => setDeckName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                      placeholder="default"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    onClick={handleCreate}
                    disabled={
                      creating ||
                      !front.trim() ||
                      !back.trim() ||
                      (cardType === "cloze" && !clozeSentence.trim())
                    }
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
            </div>
          )}

          {/* ──────────── TAB: Decks ──────────── */}
          {tab === "decks" && (
            <div>
              {decks.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
                    <FolderOpen
                      size={32}
                      className="text-gray-400 dark:text-gray-500"
                    />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">
                    {t(
                      "flashcards.noDecks",
                      "Aucun paquet. Cr\u00e9ez des cartes pour commencer.",
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* All cards option */}
                  <button
                    onClick={() => {
                      setActiveDeckFilter(null);
                      setTab("all");
                    }}
                    className={`w-full flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4 hover:shadow-sm transition-all text-left ${
                      !activeDeckFilter
                        ? "ring-2 ring-indigo-500 border-transparent"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700">
                        <Layers
                          size={18}
                          className="text-gray-500 dark:text-gray-400"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {t("flashcards.allDecks", "Toutes les cartes")}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {allCards.length}{" "}
                          {t("common.words").toLowerCase()}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-gray-400 dark:text-gray-500"
                    />
                  </button>

                  {/* Individual decks */}
                  {decks.map((deck) => (
                    <button
                      key={deck.name}
                      onClick={() => {
                        setActiveDeckFilter(deck.name);
                        setTab("all");
                      }}
                      className={`w-full flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4 hover:shadow-sm transition-all text-left ${
                        activeDeckFilter === deck.name
                          ? "ring-2 ring-indigo-500 border-transparent"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                          <FolderOpen
                            size={18}
                            className="text-indigo-600 dark:text-indigo-400"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {deck.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {deck.count}{" "}
                            {t("common.words").toLowerCase()}
                          </p>
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-gray-400 dark:text-gray-500"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
