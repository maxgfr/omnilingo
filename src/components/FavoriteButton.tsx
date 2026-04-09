import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import * as bridge from "../lib/bridge";
import ListPopover from "./ListPopover";
import type { FavoriteList } from "../types";

interface Props {
  wordId: number;
  isFavorite: boolean;
  onToggle: () => void;
  pairId?: number;
  className?: string;
}

export default function FavoriteButton({ wordId, isFavorite, onToggle, pairId, className = "" }: Props) {
  const { t } = useTranslation();
  const [showPopover, setShowPopover] = useState(false);
  const [lists, setLists] = useState<FavoriteList[]>([]);
  const [wordListIds, setWordListIds] = useState<Set<number>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!showPopover) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPopover]);

  const loadLists = useCallback(async () => {
    if (!pairId) return;
    try {
      const [fetchedLists, membershipIds] = await Promise.all([
        bridge.getFavoriteLists(pairId),
        bridge.getWordListMemberships(wordId, pairId),
      ]);
      setLists(fetchedLists);
      setWordListIds(new Set(membershipIds));
    } catch (err) {
      console.error("Failed to load lists:", err);
    }
  }, [pairId, wordId]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasFavorite = isFavorite;
    onToggle();
    bridge.toggleFavorite(wordId).catch(console.error);

    // After favoriting, auto-open list popover if pairId is provided
    if (!wasFavorite && pairId) {
      loadLists().then(() => setShowPopover(true));
    } else {
      setShowPopover(false);
    }
  };

  const handleOpenPopover = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showPopover) {
      setShowPopover(false);
    } else {
      loadLists().then(() => setShowPopover(true));
    }
  };

  const handleListsChanged = useCallback(() => {
    loadLists();
  }, [loadLists]);

  return (
    <div className="relative inline-flex items-center gap-1" ref={ref}>
      <button
        onClick={handleClick}
        className={`p-2 rounded-lg transition-all ${
          isFavorite
            ? "text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-900/20"
            : "text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
        } ${className}`}
        title={isFavorite ? t("favorites.remove") : t("favorites.addToList")}
      >
        <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
      </button>

      {/* List button — only show when favorited and pairId is provided */}
      {isFavorite && pairId && (
        <ListPopover
          wordId={wordId}
          pairId={pairId}
          lists={lists}
          wordListIds={wordListIds}
          onListsChanged={handleListsChanged}
          autoOpen={showPopover}
          onOpenChange={setShowPopover}
          onRequestOpen={handleOpenPopover}
        />
      )}
    </div>
  );
}
