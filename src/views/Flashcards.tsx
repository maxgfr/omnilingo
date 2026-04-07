import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Layers,
  Plus,
  Loader2,
  CheckCircle2,
  Play,
  RotateCcw,
  Trash2,
  FolderOpen,
  Trophy,
  Zap,
  ChevronLeft,
  X,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { useFeaturePair } from "../lib/useFeaturePair";
import { useFlashcardsStore } from "../store/useFlashcardsStore";
import LanguagePairBar from "../components/LanguagePairBar";
import * as bridge from "../lib/bridge";
import type { SrsCard, SrsStats, DeckInfo } from "../types";

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
  const { screen, selectedDeck, reviewDeck, openDeck, startReview, goHome } =
    useFlashcardsStore();

  // Data
  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [stats, setStats] = useState<SrsStats | null>(null);
  const [deckCards, setDeckCards] = useState<SrsCard[]>([]);

  // Create deck
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");

  // Add card form
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  // Delete confirmation
  const [deletingCardId, setDeletingCardId] = useState<number | null>(null);
  const [confirmDeleteDeck, setConfirmDeleteDeck] = useState(false);

  // Review session
  const [sessionCards, setSessionCards] = useState<SrsCard[]>([]);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  const currentCard = sessionCards[sessionIndex] ?? null;

  // ── Data loading ─────────────────────────────────────────────────────

  const loadDecks = useCallback(async () => {
    if (!activePair) return;
    try {
      const [d, s] = await Promise.all([
        bridge.getDecks(activePair.id),
        bridge.getSrsStats(activePair.id),
      ]);
      setDecks(d);
      setStats(s);
    } catch (err) {
      console.error("Failed to load decks:", err);
    }
  }, [activePair]);

  const loadDeckCards = useCallback(async () => {
    if (!activePair || !selectedDeck) return;
    try {
      const cards = await bridge.getAllSrsCards(activePair.id, selectedDeck);
      setDeckCards(cards);
    } catch (err) {
      console.error("Failed to load deck cards:", err);
    }
  }, [activePair, selectedDeck]);

  // Initial load
  useEffect(() => {
    if (!activePair) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadDecks().finally(() => setLoading(false));
  }, [activePair, loadDecks]);

  // Load deck cards when entering deck detail
  useEffect(() => {
    if (screen === "deck-detail" && selectedDeck) {
      loadDeckCards();
    }
  }, [screen, selectedDeck, loadDeckCards]);

  // ── Review session logic ─────────────────────────────────────────────

  const beginReview = useCallback(
    async (deck: string | null) => {
      if (!activePair) return;
      try {
        const cards = await bridge.getDueCards(activePair.id, deck ?? undefined);
        if (cards.length === 0) return;
        // Shuffle
        const shuffled = [...cards].sort(() => Math.random() - 0.5);
        setSessionCards(shuffled);
        setSessionIndex(0);
        setFlipped(false);
        setSessionResults([]);
        setSessionComplete(false);
        startReview(deck);
      } catch (err) {
        console.error("Failed to start review:", err);
      }
    },
    [activePair, startReview],
  );

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

      if (sessionIndex + 1 >= sessionCards.length) {
        setSessionComplete(true);
      } else {
        setSessionIndex((i) => i + 1);
        setFlipped(false);
      }
    } catch (err) {
      console.error("Failed to review card:", err);
    } finally {
      setReviewLoading(false);
    }
  };

  const endSession = async () => {
    setSessionCards([]);
    setSessionIndex(0);
    setSessionResults([]);
    setFlipped(false);
    setSessionComplete(false);
    goHome();
    await loadDecks();
  };

  // ── Card creation ────────────────────────────────────────────────────

  const handleCreateCard = async () => {
    if (!activePair || !front.trim() || !back.trim() || !selectedDeck) return;
    setCreating(true);
    setCreated(false);
    try {
      const wordId = await bridge.addCustomWord(
        activePair.id,
        front.trim(),
        back.trim(),
      );
      await bridge.addWordToSrs(wordId, selectedDeck);
      setFront("");
      setBack("");
      setCreated(true);
      setTimeout(() => setCreated(false), 2000);
      await loadDeckCards();
      await loadDecks();
    } catch (err) {
      console.error("Failed to create card:", err);
    } finally {
      setCreating(false);
    }
  };

  // ── Deck creation ────────────────────────────────────────────────────

  const handleCreateDeck = () => {
    if (!newDeckName.trim()) return;
    // Decks are implicit — just opening the detail with a new name is enough.
    // Cards added to this deck name will create it.
    const name = newDeckName.trim();
    setNewDeckName("");
    setShowCreateDeck(false);
    openDeck(name);
  };

  // ── Delete ───────────────────────────────────────────────────────────

  const handleDeleteCard = async (cardId: number) => {
    try {
      await bridge.deleteSrsCard(cardId);
      setDeletingCardId(null);
      await loadDeckCards();
      await loadDecks();
    } catch (err) {
      console.error("Failed to delete card:", err);
    }
  };

  const handleDeleteDeck = async () => {
    if (!activePair || !selectedDeck) return;
    try {
      await bridge.deleteDeck(activePair.id, selectedDeck);
      setConfirmDeleteDeck(false);
      goHome();
      await loadDecks();
    } catch (err) {
      console.error("Failed to delete deck:", err);
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────

  const totalDue = stats?.due_count ?? 0;

  const sessionAccuracy = useMemo(() => {
    if (sessionResults.length === 0) return 0;
    return Math.round(
      (sessionResults.filter((r) => r.quality >= 3).length /
        sessionResults.length) *
        100,
    );
  }, [sessionResults]);

  // ── Loading ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-amber-500" />
      </div>
    );
  }

  // ── Review Session Screen ────────────────────────────────────────────

  if (screen === "review") {
    // Session complete
    if (sessionComplete) {
      const correctCount = sessionResults.filter((r) => r.quality >= 3).length;
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-md">
            <div className="flex justify-center mb-6">
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <Trophy size={40} className="text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
              {t("flashcards.sessionComplete", "Session terminée !")}
            </h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
              {t("flashcards.sessionSummary", "Voici votre résumé de session")}
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{sessionResults.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("flashcards.reviewed", "Révisées")}</p>
              </div>
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{correctCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("flashcards.correct", "Correctes")}</p>
              </div>
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{sessionAccuracy}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("flashcards.accuracy", "Précision")}</p>
              </div>
            </div>

            {/* Results list */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden mb-6">
              <div className="max-h-64 overflow-y-auto">
                {sessionResults.map((result, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-gray-100 dark:border-gray-700/50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{result.sourceWord}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.targetWord}</p>
                    </div>
                    <span
                      className={`flex-shrink-0 ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        result.quality >= 3
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {result.quality >= 3 ? t("flashcards.good", "Bien") : t("flashcards.again", "À revoir")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

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
                  setTimeout(() => beginReview(reviewDeck), 100);
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

    // Active card
    return (
      <div className="flex flex-col items-center min-h-[60vh]">
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
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${((sessionIndex + 1) / sessionCards.length) * 100}%` }}
            />
          </div>
        </div>

        {currentCard && (
          <div className="w-full max-w-lg">
            <div
              className="perspective-1000 w-full cursor-pointer"
              onClick={() => !flipped && setFlipped(true)}
            >
              <div
                className={`relative w-full transform-3d transition-transform duration-500 ${flipped ? "rotate-y-180" : ""}`}
                style={{ minHeight: "280px" }}
              >
                {/* Front */}
                <div className="absolute inset-0 backface-hidden rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 shadow-lg flex flex-col items-center justify-center p-8">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{currentCard.source_word}</p>
                  <p className="absolute bottom-4 text-xs text-gray-400 dark:text-gray-500">
                    {t("flashcards.tapToFlip", "Cliquez pour révéler")}
                  </p>
                </div>

                {/* Back */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 shadow-lg flex flex-col items-center justify-center p-8">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{currentCard.target_word}</p>
                  {currentCard.gender && (
                    <p className="text-lg text-indigo-500 dark:text-indigo-400 mt-1 font-medium">{currentCard.gender}</p>
                  )}
                  {currentCard.example_target && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 italic">{currentCard.example_target}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Rating buttons */}
            {flipped && (
              <div className="mt-6 grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleRate(0)}
                  disabled={reviewLoading}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-medium text-sm transition-all disabled:opacity-50"
                >
                  {reviewLoading ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                  <span className="text-xs">{t("flashcards.again", "À revoir")}</span>
                </button>
                <button
                  onClick={() => handleRate(3)}
                  disabled={reviewLoading}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-medium text-sm transition-all disabled:opacity-50"
                >
                  {reviewLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  <span className="text-xs">{t("flashcards.good", "Bien")}</span>
                </button>
                <button
                  onClick={() => handleRate(5)}
                  disabled={reviewLoading}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-medium text-sm transition-all disabled:opacity-50"
                >
                  {reviewLoading ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                  <span className="text-xs">{t("flashcards.easy", "Facile")}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Deck Detail Screen ───────────────────────────────────────────────

  if (screen === "deck-detail" && selectedDeck) {
    const deckDue = decks.find((d) => d.name === selectedDeck)?.due_count ?? 0;

    return (
      <div className="space-y-6">
        <LanguagePairBar pairs={languagePairs} activePairId={activePair?.id ?? null} onSwitch={switchPair} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goHome}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedDeck}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {deckCards.length} {t("flashcards.totalCards", "cartes").toLowerCase()}
                {deckDue > 0 && ` · ${deckDue} ${t("flashcards.due", "à réviser").toLowerCase()}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {deckDue > 0 && (
              <button
                onClick={() => beginReview(selectedDeck)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
              >
                <Play size={16} />
                {t("flashcards.review", "Réviser")} ({deckDue})
              </button>
            )}
            <button
              onClick={() => setConfirmDeleteDeck(true)}
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title={t("flashcards.deleteDeck", "Supprimer le paquet")}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Delete deck confirmation */}
        {confirmDeleteDeck && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-center justify-between">
            <p className="text-sm text-red-700 dark:text-red-400">
              {t("flashcards.confirmDeleteDeck", "Supprimer toutes les cartes de ce paquet ?")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteDeck(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {t("common.cancel", "Annuler")}
              </button>
              <button
                onClick={handleDeleteDeck}
                className="px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                {t("common.delete", "Supprimer")}
              </button>
            </div>
          </div>
        )}

        {/* Card list */}
        {deckCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <FolderOpen size={48} className="text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("flashcards.emptyDeck", "Ce paquet est vide. Ajoutez des cartes pour commencer.")}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
              {deckCards.map((card) => (
                <div key={card.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{card.source_word}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{card.target_word}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        card.repetitions === 0
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : card.repetitions < 5
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {card.repetitions === 0
                        ? t("flashcards.new", "Nouveau")
                        : card.repetitions < 5
                          ? t("flashcards.learning", "En cours")
                          : t("flashcards.mastered", "Maîtrisé")}
                    </span>
                    {deletingCardId === card.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          {t("common.delete", "Suppr.")}
                        </button>
                        <button
                          onClick={() => setDeletingCardId(null)}
                          className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                          {t("common.cancel", "Annuler")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingCardId(card.id)}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add card form */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {t("flashcards.addCard", "Ajouter une carte")}
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder={t("flashcards.front", "Recto (question)")}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && handleCreateCard()}
            />
            <input
              type="text"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder={t("flashcards.back", "Verso (réponse)")}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && handleCreateCard()}
            />
            <button
              onClick={handleCreateCard}
              disabled={creating || !front.trim() || !back.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : created ? (
                <CheckCircle2 size={16} />
              ) : (
                <Plus size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Deck List Screen (home) ──────────────────────────────────────────

  return (
    <div className="space-y-6">
      <LanguagePairBar pairs={languagePairs} activePairId={activePair?.id ?? null} onSwitch={switchPair} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
            <Layers size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("flashcards.title")}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stats ? `${stats.total_cards} ${t("flashcards.totalCards", "cartes").toLowerCase()}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {totalDue > 0 && (
            <button
              onClick={() => beginReview(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
            >
              <Play size={16} />
              {t("flashcards.reviewAll", "Tout réviser")} ({totalDue})
            </button>
          )}
          <button
            onClick={() => setShowCreateDeck(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} />
            {t("flashcards.createDeck", "Nouveau paquet")}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && stats.total_cards > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_cards}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("flashcards.totalCards", "Total")}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.due_count}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("flashcards.due", "À réviser")}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.average_accuracy}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("flashcards.accuracy", "Précision")}</p>
          </div>
        </div>
      )}

      {/* Create deck form */}
      {showCreateDeck && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              placeholder={t("flashcards.deckName", "Nom du paquet")}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateDeck();
                if (e.key === "Escape") setShowCreateDeck(false);
              }}
            />
            <button
              onClick={handleCreateDeck}
              disabled={!newDeckName.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {t("flashcards.create", "Créer")}
            </button>
            <button
              onClick={() => { setShowCreateDeck(false); setNewDeckName(""); }}
              className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {t("common.cancel", "Annuler")}
            </button>
          </div>
        </div>
      )}

      {/* Deck grid */}
      {decks.length === 0 && !showCreateDeck ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <FolderOpen size={48} className="text-gray-300 dark:text-gray-600" />
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("flashcards.noCards", "Pas encore de flashcards")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("flashcards.noDecks", "Créez un paquet pour commencer.")}
            </p>
          </div>
          <button
            onClick={() => setShowCreateDeck(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
          >
            <Plus size={16} />
            {t("flashcards.createDeck", "Nouveau paquet")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {decks.map((deck) => (
            <button
              key={deck.name}
              onClick={() => openDeck(deck.name)}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all text-left"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex-shrink-0">
                <FolderOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{deck.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {deck.card_count} {t("flashcards.totalCards", "cartes").toLowerCase()}
                </p>
              </div>
              {deck.due_count > 0 && (
                <span className="flex-shrink-0 bg-amber-500 text-white text-xs px-2.5 py-1 rounded-full font-semibold">
                  {deck.due_count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
