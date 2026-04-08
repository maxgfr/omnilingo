import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Loader2,
  CheckCircle2,
  Play,
  RotateCcw,
  Trash2,
  FolderOpen,
  Trophy,
  ChevronLeft,
  X,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useFeaturePair } from "../lib/useFeaturePair";
import * as bridge from "../lib/bridge";
import type { SrsCard, SrsStats, DeckInfo } from "../types";
import Spinner from "../components/ui/Spinner";
import PageHeader from "../components/ui/PageHeader";
import ExamplePreview from "../components/ui/ExamplePreview";
import { FLASHCARD_EXAMPLE } from "../lib/exampleData";

interface SessionResult {
  cardId: number;
  quality: number;
  sourceWord: string;
  targetWord: string;
}

export default function Flashcards() {
  const { t } = useTranslation();
  const { activePair } = useFeaturePair("flashcards");
  const screen = useAppStore((s) => s.flashcardsScreen);
  const selectedDeck = useAppStore((s) => s.selectedDeck);
  const reviewDeck = useAppStore((s) => s.reviewDeck);
  const openDeck = useAppStore((s) => s.openDeck);
  const startReview = useAppStore((s) => s.startReview);
  const goHome = useAppStore((s) => s.goHome);
  const createdDecks = useAppStore((s) => s.createdDecks);
  const addCreatedDeck = useAppStore((s) => s.addCreatedDeck);
  const removeCreatedDeck = useAppStore((s) => s.removeCreatedDeck);

  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState<DeckInfo[]>([]);
  const [stats, setStats] = useState<SrsStats | null>(null);
  const [deckCards, setDeckCards] = useState<SrsCard[]>([]);

  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");

  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDeleteDeck, setConfirmDeleteDeck] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<number | null>(null);

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
      setDeckCards(await bridge.getAllSrsCards(activePair.id, selectedDeck));
    } catch (err) {
      console.error("Failed to load deck cards:", err);
    }
  }, [activePair, selectedDeck]);

  useEffect(() => {
    if (!activePair) { setLoading(false); return; }
    setLoading(true);
    loadDecks().finally(() => setLoading(false));
  }, [activePair, loadDecks]);

  useEffect(() => {
    if (screen === "deck-detail" && selectedDeck) loadDeckCards();
  }, [screen, selectedDeck, loadDeckCards]);

  // ── Review ─────────────────────────────────────────────────────────

  const beginReview = useCallback(async (deck: string | null) => {
    if (!activePair) return;
    const cards = await bridge.getDueCards(activePair.id, deck ?? undefined);
    if (cards.length === 0) return;
    setSessionCards([...cards].sort(() => Math.random() - 0.5));
    setSessionIndex(0);
    setFlipped(false);
    setSessionResults([]);
    setSessionComplete(false);
    startReview(deck);
  }, [activePair, startReview]);

  async function handleRate(quality: number) {
    if (!currentCard || reviewLoading) return;
    setReviewLoading(true);
    try {
      await bridge.reviewCard(currentCard.id, quality);
    } catch (err) {
      console.error("Failed to review card:", err);
    }
    setSessionResults((prev) => [...prev, {
      cardId: currentCard.id, quality,
      sourceWord: currentCard.source_word,
      targetWord: currentCard.target_word,
    }]);
    if (sessionIndex + 1 >= sessionCards.length) {
      setSessionComplete(true);
    } else {
      setSessionIndex((i) => i + 1);
      setFlipped(false);
    }
    setReviewLoading(false);
  }

  async function endSession() {
    setSessionCards([]);
    setSessionIndex(0);
    setSessionResults([]);
    setSessionComplete(false);
    goHome();
    await loadDecks();
  }

  // ── Card / Deck CRUD ──────────────────────────────────────────────

  async function handleCreateCard() {
    if (!activePair || !front.trim() || !back.trim() || !selectedDeck) return;
    setCreating(true);
    try {
      const wordId = await bridge.addCustomWord(activePair.id, front.trim(), back.trim());
      await bridge.addWordToSrs(wordId, selectedDeck);
      removeCreatedDeck(selectedDeck);
      setFront(""); setBack("");
      await loadDeckCards();
      await loadDecks();
    } catch (err) {
      console.error("Failed to create card:", err);
    } finally {
      setCreating(false);
    }
  }

  function handleCreateDeck() {
    const name = newDeckName.trim();
    if (!name) return;
    setNewDeckName("");
    setShowCreateDeck(false);
    addCreatedDeck(name);
    openDeck(name);
  }

  async function handleDeleteCard(cardId: number) {
    await bridge.deleteSrsCard(cardId);
    setDeletingCardId(null);
    await loadDeckCards();
    await loadDecks();
  }

  async function handleDeleteDeck() {
    if (!activePair || !selectedDeck) return;
    await bridge.deleteDeck(activePair.id, selectedDeck);
    removeCreatedDeck(selectedDeck);
    setConfirmDeleteDeck(false);
    goHome();
    await loadDecks();
  }

  // ── Derived ───────────────────────────────────────────────────────

  const allDecks = useMemo(() => {
    const deckNames = new Set(decks.map((d) => d.name));
    const empty: DeckInfo[] = createdDecks
      .filter((n) => !deckNames.has(n))
      .map((n) => ({ name: n, card_count: 0, due_count: 0 }));
    return [...decks, ...empty];
  }, [decks, createdDecks]);

  const totalDue = stats?.due_count ?? 0;

  // ── Loading ───────────────────────────────────────────────────────

  if (loading) {
    return <Spinner fullPage />;
  }

  // ── Review Screen ─────────────────────────────────────────────────

  if (screen === "review") {
    if (sessionComplete) {
      const correct = sessionResults.filter((r) => r.quality >= 3).length;
      const pct = Math.round((correct / sessionResults.length) * 100);
      return (
        <div className="max-w-md mx-auto py-10 space-y-6">
          <div className="text-center">
            <Trophy size={40} className="mx-auto mb-3 text-amber-500" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t("flashcards.sessionComplete", "Session terminée !")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {correct}/{sessionResults.length} ({pct}%)
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/50 max-h-64 overflow-y-auto">
            {sessionResults.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.sourceWord}</p>
                  <p className="text-xs text-gray-400 truncate">{r.targetWord}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-3 ${
                  r.quality >= 3
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                }`}>
                  {r.quality >= 3 ? t("flashcards.good", "Bien") : t("flashcards.again", "À revoir")}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={endSession}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              {t("common.back", "Retour")}
            </button>
            <button onClick={async () => { await endSession(); setTimeout(() => beginReview(reviewDeck), 100); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition-colors">
              <RotateCcw size={14} />
              {t("flashcards.reviewAgain", "Recommencer")}
            </button>
          </div>
        </div>
      );
    }

    // Active review card
    return (
      <div className="max-w-lg mx-auto py-6">
        {/* Progress */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={endSession} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            <X size={16} />
            {t("flashcards.endSession", "Terminer")}
          </button>
          <span className="text-sm font-medium text-gray-500">{sessionIndex + 1}/{sessionCards.length}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-8">
          <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${((sessionIndex + 1) / sessionCards.length) * 100}%` }} />
        </div>

        {currentCard && (
          <>
            {/* Card */}
            <div
              className="perspective-1000 w-full cursor-pointer mb-6"
              onClick={() => !flipped && setFlipped(true)}
            >
              <div className={`relative w-full transform-3d transition-transform duration-500 ${flipped ? "rotate-y-180" : ""}`} style={{ minHeight: "260px" }}>
                <div className="absolute inset-0 backface-hidden rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 shadow-sm flex flex-col items-center justify-center p-8">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{currentCard.source_word}</p>
                  {currentCard.gender && <p className="text-sm text-amber-500 mt-2 font-medium">{currentCard.gender}</p>}
                  <p className="absolute bottom-4 text-xs text-gray-400">{t("flashcards.tapToFlip", "Cliquez pour révéler")}</p>
                </div>
                <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 shadow-sm flex flex-col items-center justify-center p-8">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{currentCard.target_word}</p>
                  {currentCard.example_target && <p className="text-sm text-gray-500 mt-4 italic">{currentCard.example_target}</p>}
                </div>
              </div>
            </div>

            {/* Rating */}
            {flipped && (
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => handleRate(0)} disabled={reviewLoading}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  <X size={18} />
                  <span className="text-xs">{t("flashcards.again", "À revoir")}</span>
                </button>
                <button onClick={() => handleRate(3)} disabled={reviewLoading}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  <CheckCircle2 size={18} />
                  <span className="text-xs">{t("flashcards.good", "Bien")}</span>
                </button>
                <button onClick={() => handleRate(5)} disabled={reviewLoading}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  <Trophy size={18} />
                  <span className="text-xs">{t("flashcards.easy", "Facile")}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Deck Detail ───────────────────────────────────────────────────

  if (screen === "deck-detail" && selectedDeck) {
    const deckDue = allDecks.find((d) => d.name === selectedDeck)?.due_count ?? 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={goHome} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <PageHeader
              title={selectedDeck}
              subtitle={`${deckCards.length} ${t("flashcards.totalCards", "cartes").toLowerCase()}${deckDue > 0 ? ` · ${deckDue} ${t("flashcards.due", "à réviser").toLowerCase()}` : ""}`}
            />
          </div>
          <div className="flex gap-2">
            {deckDue > 0 && (
              <button onClick={() => beginReview(selectedDeck)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors">
                <Play size={16} />
                {t("flashcards.review", "Réviser")} ({deckDue})
              </button>
            )}
            <button onClick={() => setConfirmDeleteDeck(true)}
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {confirmDeleteDeck && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-center justify-between">
            <p className="text-sm text-red-700 dark:text-red-400">
              {t("flashcards.confirmDeleteDeck", "Supprimer ce paquet et toutes ses cartes ?")}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteDeck(false)} className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                {t("common.cancel", "Annuler")}
              </button>
              <button onClick={handleDeleteDeck} className="px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors">
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
              {t("flashcards.emptyDeck", "Ce paquet est vide.")}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/50 max-h-[400px] overflow-y-auto">
            {deckCards.map((card) => (
              <div key={card.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{card.source_word}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{card.target_word}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    card.repetitions === 0
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : card.repetitions < 5
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {card.repetitions === 0
                      ? t("flashcards.new", "Nouveau")
                      : card.repetitions < 5
                        ? t("flashcards.learning", "En cours")
                        : t("flashcards.mastered", "Maîtrisé")}
                  </span>
                  {deletingCardId === card.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDeleteCard(card.id)} className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600">
                        OK
                      </button>
                      <button onClick={() => setDeletingCardId(null)} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {t("common.cancel", "Non")}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeletingCardId(card.id)} className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add card */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {t("flashcards.addCard", "Ajouter une carte")}
          </h3>
          <div className="flex gap-3">
            <input type="text" value={front} onChange={(e) => setFront(e.target.value)}
              placeholder={t("flashcards.front", "Recto")}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCard()}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
            <input type="text" value={back} onChange={(e) => setBack(e.target.value)}
              placeholder={t("flashcards.back", "Verso")}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCard()}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
            <button onClick={handleCreateCard} disabled={creating || !front.trim() || !back.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Deck List (home) ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("flashcards.title")}
        subtitle={stats
          ? `${stats.total_cards} ${t("flashcards.totalCards", "cartes").toLowerCase()}${totalDue > 0 ? ` · ${totalDue} ${t("flashcards.due", "à réviser").toLowerCase()}` : ""}`
          : ""}
        rightSlot={
          <>
            {totalDue > 0 && (
              <button onClick={() => beginReview(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors">
                <Play size={16} />
                {t("flashcards.reviewAll", "Tout réviser")} ({totalDue})
              </button>
            )}
            <button onClick={() => setShowCreateDeck(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Plus size={16} />
            </button>
          </>
        }
      />

      {/* Create deck form */}
      {showCreateDeck && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
          <div className="flex gap-3">
            <input type="text" value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)}
              placeholder={t("flashcards.deckName", "Nom du paquet")}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateDeck(); if (e.key === "Escape") setShowCreateDeck(false); }}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40" />
            <button onClick={handleCreateDeck} disabled={!newDeckName.trim()}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {t("flashcards.create", "Créer")}
            </button>
            <button onClick={() => { setShowCreateDeck(false); setNewDeckName(""); }}
              className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {t("common.cancel", "Annuler")}
            </button>
          </div>
        </div>
      )}

      {/* Deck grid */}
      {allDecks.length === 0 && !showCreateDeck ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <FolderOpen size={48} className="text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("flashcards.noDecks", "Créez un paquet pour commencer.")}</p>
          <button onClick={() => setShowCreateDeck(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors">
            <Plus size={16} />
            {t("flashcards.createDeck", "Nouveau paquet")}
          </button>
          <ExamplePreview onClick={() => setShowCreateDeck(true)}>
            <div className="perspective-1000 w-64 mx-auto">
              <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 flex flex-col items-center justify-center p-8">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{FLASHCARD_EXAMPLE.front}</p>
                <p className="text-sm text-amber-500 mt-2 font-medium">{FLASHCARD_EXAMPLE.gender}</p>
                <p className="text-lg text-gray-500 dark:text-gray-400 mt-3">{FLASHCARD_EXAMPLE.back}</p>
              </div>
            </div>
          </ExamplePreview>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {allDecks.map((deck) => (
            <button key={deck.name} onClick={() => openDeck(deck.name)}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm transition-all text-left">
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
