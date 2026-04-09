import { useState, useRef, useEffect } from "react";
import { ListPlus, Plus, Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import * as bridge from "../lib/bridge";
import type { FavoriteList } from "../types";

interface Props {
  wordId: number;
  pairId: number;
  lists: FavoriteList[];
  wordListIds?: Set<number>;
  onListsChanged?: () => void;
  /** Controlled open state (from FavoriteButton) */
  autoOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRequestOpen?: (e: React.MouseEvent) => void;
}

export default function ListPopover({
  wordId,
  pairId,
  lists,
  wordListIds,
  onListsChanged,
  autoOpen,
  onOpenChange,
  onRequestOpen,
}: Props) {
  const { t } = useTranslation();
  const isControlled = autoOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? autoOpen : internalOpen;
  const setOpen = isControlled
    ? (v: boolean) => onOpenChange?.(v)
    : setInternalOpen;

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click (only for uncontrolled mode)
  useEffect(() => {
    if (isControlled || !open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, isControlled]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const list = await bridge.createFavoriteList(name, pairId);
      await bridge.addToFavoriteList(list.id, wordId);
      setNewName("");
      onListsChanged?.();
    } catch (err) {
      console.error("Failed to create list:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (listId: number) => {
    if (adding != null) return;
    setAdding(listId);
    try {
      if (wordListIds?.has(listId)) {
        await bridge.removeFromFavoriteList(listId, wordId);
      } else {
        await bridge.addToFavoriteList(listId, wordId);
      }
      onListsChanged?.();
    } catch (err) {
      console.error("Failed to toggle list:", err);
    } finally {
      setAdding(null);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRequestOpen) {
      onRequestOpen(e);
    } else {
      setOpen(!open);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleButtonClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm transition-colors"
      >
        <ListPlus size={14} />
        <span>{t("favorites.list")}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
          {lists.length > 0 && (
            <div className="max-h-48 overflow-y-auto py-1">
              {lists.map((list) => {
                const isIn = wordListIds?.has(list.id) ?? false;
                return (
                  <button
                    key={list.id}
                    onClick={(e) => { e.stopPropagation(); handleToggle(list.id); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {adding === list.id ? (
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                    ) : isIn ? (
                      <Check size={14} className="text-amber-500" />
                    ) : (
                      <Plus size={14} className="text-gray-400" />
                    )}
                    <span className={`flex-1 text-left truncate ${isIn ? "text-amber-600 dark:text-amber-400 font-medium" : "text-gray-700 dark:text-gray-300"}`}>
                      {list.name}
                    </span>
                    <span className="text-xs text-gray-400">{list.item_count}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 p-2">
            <div className="flex gap-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                onClick={(e) => e.stopPropagation()}
                placeholder={t("favorites.listName")}
                className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/40 placeholder:text-gray-400"
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleCreate(); }}
                disabled={!newName.trim() || creating}
                className="px-2 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium disabled:opacity-50 hover:bg-amber-600 transition-colors"
              >
                {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
