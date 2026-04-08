import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layers, Plus, Check, Loader2 } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import * as bridge from "../lib/bridge";
import type { DeckInfo } from "../types";

interface Props {
  wordId: number;
  pairId: number;
  decks: DeckInfo[];
  onDecksChanged?: () => void;
}

export default function DeckPopover({ wordId, decks, onDecksChanged }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset added state when wordId changes
  useEffect(() => {
    setAdded(new Set());
  }, [wordId]);

  // Merge backend decks with locally-created empty decks
  const createdDecks = useAppStore((s) => s.createdDecks);
  const allDecks: DeckInfo[] = [...decks];
  for (const name of createdDecks) {
    if (!allDecks.find((d) => d.name === name)) {
      allDecks.push({ name, card_count: 0, due_count: 0 });
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewDeckName("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input when creating
  useEffect(() => {
    if (creating) setTimeout(() => inputRef.current?.focus(), 0);
  }, [creating]);

  async function handleAddToDeck(deckName: string) {
    if (adding || added.has(deckName)) return;
    setAdding(deckName);
    try {
      await bridge.addWordToSrs(wordId, deckName);
      setAdded((prev) => new Set(prev).add(deckName));
    } catch (err) {
      console.error("Failed to add to deck:", err);
    } finally {
      setAdding(null);
    }
  }

  async function handleCreateDeck() {
    const name = newDeckName.trim();
    if (!name) return;
    useAppStore.getState().addCreatedDeck(name);
    setNewDeckName("");
    setCreating(false);
    await handleAddToDeck(name);
    onDecksChanged?.();
  }

  function toggleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open) {
      // Reset state when opening
      setCreating(false);
      setNewDeckName("");
    }
    setOpen(!open);
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={toggleOpen}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-amber-400 dark:hover:border-amber-500 text-sm font-medium transition-all"
      >
        <Layers size={14} />
        Deck
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Deck list */}
          <div className="max-h-48 overflow-y-auto">
            {allDecks.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400 text-center">
                {t("flashcards.noDecks", "Aucun deck")}
              </div>
            ) : (
              allDecks.map((deck) => {
                const isAdded = added.has(deck.name);
                const isAdding = adding === deck.name;
                return (
                  <button
                    key={deck.name}
                    onClick={() => handleAddToDeck(deck.name)}
                    disabled={isAdded || !!adding}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors ${
                      isAdded
                        ? "bg-emerald-50 dark:bg-emerald-900/10"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{deck.name}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {deck.card_count} {t("flashcards.cards", "cartes")}
                      </span>
                    </div>
                    {isAdded ? (
                      <Check size={14} className="text-emerald-500 flex-shrink-0" />
                    ) : isAdding ? (
                      <Loader2 size={14} className="animate-spin text-gray-400 flex-shrink-0" />
                    ) : (
                      <Plus size={14} className="text-gray-300 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-gray-100 dark:border-gray-700" />

          {/* Create new deck */}
          {creating ? (
            <div className="p-3 flex gap-2">
              <input
                ref={inputRef}
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newDeckName.trim()) handleCreateDeck();
                  if (e.key === "Escape") { setCreating(false); setNewDeckName(""); }
                }}
                placeholder={t("flashcards.deckName", "Nom du deck...")}
                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-gray-400"
              />
              <button
                onClick={() => handleCreateDeck()}
                disabled={!newDeckName.trim()}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                OK
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full text-left px-4 py-2.5 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors font-medium"
            >
              <Plus size={14} />
              {t("flashcards.createDeck", "Créer un deck")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
