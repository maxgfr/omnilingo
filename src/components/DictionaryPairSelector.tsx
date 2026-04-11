import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2, Plus, Check, ChevronDown, Search } from "lucide-react";
import * as bridge from "../lib/bridge";
import type { LanguagePair } from "../types";
import { LANGUAGES, type Language } from "../lib/languages";
import { useAppStore } from "../store/useAppStore";

interface Props {
  pairs: LanguagePair[];
  onChange: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Searchable language combobox — text input with filtered dropdown.
// Native <select> doesn't support search, and with ~89 languages a flat list
// is painful to scroll, so we render a small custom picker.
// ---------------------------------------------------------------------------
interface ComboboxProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  excludeCode?: string;
  placeholder: string;
  noMatchLabel: string;
  disabled?: boolean;
}

function LanguageCombobox({ label, value, onChange, excludeCode, placeholder, noMatchLabel, disabled }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);

  const selected = useMemo(() => LANGUAGES.find((l) => l.code === value), [value]);

  const filtered = useMemo<Language[]>(() => {
    const q = query.trim().toLowerCase();
    return LANGUAGES.filter((l) => l.code !== excludeCode).filter((l) =>
      q === "" ? true : l.name.toLowerCase().includes(q) || l.code.includes(q),
    );
  }, [query, excludeCode]);

  // Compute fixed-position coordinates from the trigger's bounding box.
  // useLayoutEffect so the dropdown appears in the right place on first paint.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({ left: rect.left, top: rect.bottom + 4, width: rect.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Close on outside click — both the trigger and the portal-rendered dropdown
  // count as "inside".
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleSelect = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="flex-1">
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selected ? "" : "text-gray-400"}>
          {selected ? `${selected.flag} ${selected.name}` : `${placeholder}…`}
        </span>
        <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
      </button>

      {open && position && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            left: position.left,
            top: position.top,
            width: position.width,
            zIndex: 9999,
          }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
        >
          <div className="relative border-b border-gray-100 dark:border-gray-700">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-9 pr-3 py-2 text-sm bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-400 italic">{noMatchLabel}</li>
            ) : (
              filtered.map((lang) => (
                <li key={lang.code}>
                  <button
                    type="button"
                    onClick={() => handleSelect(lang.code)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      lang.code === value ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DictionaryPairSelector — main component
// ---------------------------------------------------------------------------
export default function DictionaryPairSelector({ pairs, onChange }: Props) {
  const { t } = useTranslation();
  const switchPair = useAppStore((s) => s.switchPair);

  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sourceCode, setSourceCode] = useState<string>("");
  const [targetCode, setTargetCode] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Pair lookup keyed by "src-tgt" for fast "already exists" checks
  const existingKeys = useMemo(
    () => new Set(pairs.map((p) => `${p.source_lang}-${p.target_lang}`)),
    [pairs],
  );

  const pairAlreadyExists =
    sourceCode && targetCode && existingKeys.has(`${sourceCode}-${targetCode}`);

  const handleDelete = async (pairId: number) => {
    setDeleting(pairId);
    setError(null);
    try {
      await bridge.deleteLanguagePair(pairId);
      await onChange();
    } catch (err) {
      setError(String(err));
    } finally {
      setDeleting(null);
    }
  };

  const handleCreate = async () => {
    if (!sourceCode || !targetCode) return;
    const src = LANGUAGES.find((l) => l.code === sourceCode);
    const tgt = LANGUAGES.find((l) => l.code === targetCode);
    if (!src || !tgt) return;

    setCreating(true);
    setError(null);
    try {
      const newId = await bridge.createLanguagePair(
        src.code, src.name, src.flag,
        tgt.code, tgt.name, tgt.flag,
      );
      await onChange();

      // Auto-activate the newly created pair so the rest of the app
      // immediately reflects it.
      switchPair(newId);

      setSourceCode("");
      setTargetCode("");
      setShowAdd(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Existing pairs with delete */}
      {pairs.length > 0 && (
        <div className="space-y-1.5">
          {pairs.map((pair) => (
            <div
              key={pair.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 text-sm">
                <span>{pair.source_flag}</span>
                <span className="font-medium text-gray-900 dark:text-white">{pair.source_name}</span>
                <span className="text-gray-400">{"\u2192"}</span>
                <span>{pair.target_flag}</span>
                <span className="font-medium text-gray-900 dark:text-white">{pair.target_name}</span>
              </div>
              <button
                onClick={() => handleDelete(pair.id)}
                disabled={deleting === pair.id}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                title={t("dictionary.deletePair")}
              >
                {deleting === pair.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      {/* Add language pair toggle */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all w-full ${
          showAdd
            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
            : "bg-gray-50 dark:bg-gray-800 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
        }`}
      >
        <Plus size={14} />
        <span>{t("dictionary.addPair")}</span>
      </button>

      {/* Inline pair picker */}
      {showAdd && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <LanguageCombobox
              label={t("dictionary.sourceLanguage")}
              value={sourceCode}
              onChange={(code) => {
                setSourceCode(code);
                if (code === targetCode) setTargetCode("");
              }}
              placeholder={t("dictionary.searchLanguage")}
              noMatchLabel={t("dictionary.noLanguageMatch")}
            />
            <LanguageCombobox
              label={t("dictionary.targetLanguage")}
              value={targetCode}
              onChange={setTargetCode}
              excludeCode={sourceCode || undefined}
              placeholder={t("dictionary.searchLanguage")}
              noMatchLabel={t("dictionary.noLanguageMatch")}
              disabled={!sourceCode}
            />
          </div>

          {pairAlreadyExists ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
              <Check size={14} />
              {t("dictionary.pairExists")}
            </div>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!sourceCode || !targetCode || creating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {creating ? t("dictionary.creating") : t("dictionary.createPair")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
