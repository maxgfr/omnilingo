import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Fuse from "fuse.js";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search, BookOpen, BookText, Languages, MessageSquare,
  RefreshCw, SpellCheck, ArrowRightLeft, FileSearch, Settings,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action: () => void;
  keywords?: string;
}

export default function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = useMemo(() => [
    { id: "dictionary", label: t("nav.dictionary"), icon: BookOpen, action: () => navigate("/dictionary"), keywords: "words search find dictionnaire" },
    { id: "grammar", label: t("nav.grammar"), icon: BookText, action: () => navigate("/grammar"), keywords: "rules syntax grammaire" },
    { id: "conjugation", label: t("nav.conjugation"), icon: Languages, action: () => navigate("/conjugation"), keywords: "verbs tenses conjugaison" },

    { id: "conversation", label: t("nav.conversation"), icon: MessageSquare, action: () => navigate("/conversation"), keywords: "chat ai tutor scenario" },
    { id: "rephrase", label: t("nav.rephrase"), icon: RefreshCw, action: () => navigate("/rephrase"), keywords: "reformuler rewrite" },
    { id: "corrector", label: t("nav.corrector"), icon: SpellCheck, action: () => navigate("/corrector"), keywords: "correcteur grammar spelling" },
    { id: "synonyms", label: t("nav.synonyms"), icon: ArrowRightLeft, action: () => navigate("/synonyms"), keywords: "synonymes similar words" },
    { id: "text-analysis", label: t("nav.textAnalysis"), icon: FileSearch, action: () => navigate("/text-analysis"), keywords: "analyse sentence mining" },
    { id: "settings", label: t("nav.settings"), icon: Settings, action: () => navigate("/settings"), keywords: "preferences config parametres" },
  ], [t, navigate]);

  const commandFuse = useMemo(
    () => new Fuse(commands, { keys: ["label", "keywords"], threshold: 0.4 }),
    [commands],
  );

  const filtered = query.trim()
    ? commandFuse.search(query.trim()).map((r) => r.item)
    : commands;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      setOpen(false);
    }
  }, [filtered, selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-gray-200 dark:border-gray-700">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t("commandPalette.placeholder")}
            className="flex-1 py-3.5 bg-transparent text-gray-900 dark:text-white text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-400 font-mono">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">{t("common.noResults")}</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => { cmd.action(); setOpen(false); }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  i === selectedIndex
                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <cmd.icon size={18} className={i === selectedIndex ? "text-amber-500" : "text-gray-400"} />
                <span className="font-medium">{cmd.label}</span>
                {i === selectedIndex && (
                  <span className="ml-auto text-xs text-gray-400">{"\u21B5"}</span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between text-[10px] text-gray-400">
          <span>{"\u2191\u2193"} {t("common.navigate")} {"\u00B7"} {"\u21B5"} {t("commandPalette.select")} {"\u00B7"} ESC {t("commandPalette.close")}</span>
          <span>{"\u2318"}K</span>
        </div>
      </div>
    </div>
  );
}
