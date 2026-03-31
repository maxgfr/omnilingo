import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookMarked, BookOpen, ArrowRightLeft, Table, Plus, Check, X, Volume2 } from "lucide-react";
import { useApp } from "../../store/AppContext";
import * as bridge from "../../lib/bridge";
import { speak } from "../../lib/speech";

type ToolTab = "translate" | "context" | "corrector" | "rephrase" | "conjugate" | "synonyms" | "definition" | "daily" | "reader" | "pronunciation";

interface WordActionBarProps {
  word: string;
  onNavigate: (tab: ToolTab, word: string) => void;
  onClose: () => void;
}

export default function WordActionBar({ word, onNavigate, onClose }: WordActionBarProps) {
  const { t } = useTranslation();
  const { activePair } = useApp();
  const [srsAdded, setSrsAdded] = useState(false);
  const [srsLoading, setSrsLoading] = useState(false);

  const handleAddToSrs = async () => {
    if (!activePair || srsAdded || srsLoading) return;
    setSrsLoading(true);
    try {
      const words = await bridge.searchWords(activePair.id, word);
      if (words.length > 0) {
        await bridge.addWordToSrs(words[0].id);
        setSrsAdded(true);
      }
    } catch { /* already added or not found */ }
    finally { setSrsLoading(false); }
  };

  const actions = [
    { key: "context" as ToolTab, icon: BookMarked, label: t("tools.tabs.context") },
    { key: "definition" as ToolTab, icon: BookOpen, label: t("tools.tabs.definition") },
    { key: "synonyms" as ToolTab, icon: ArrowRightLeft, label: t("tools.tabs.synonyms") },
    { key: "conjugate" as ToolTab, icon: Table, label: t("tools.tabs.conjugate") },
  ];

  return (
    <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl animate-fadeIn flex-wrap">
      <button
        onClick={() => speak(word, activePair?.source_lang || "de")}
        className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
      >
        <Volume2 size={14} className="text-indigo-600 dark:text-indigo-400" />
      </button>
      <span className="font-semibold text-indigo-800 dark:text-indigo-200 text-sm">"{word}"</span>
      <div className="h-4 w-px bg-indigo-200 dark:bg-indigo-700 mx-1" />

      {actions.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => onNavigate(key, word)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-600 dark:hover:text-indigo-300 transition-colors"
        >
          <Icon size={12} />
          {label}
        </button>
      ))}

      <button
        onClick={handleAddToSrs}
        disabled={srsAdded || srsLoading}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          srsAdded
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
            : "bg-indigo-600 hover:bg-indigo-700 text-white"
        }`}
      >
        {srsAdded ? <Check size={12} /> : <Plus size={12} />}
        {srsAdded ? t("common.added") : "+ SRS"}
      </button>

      <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
        <X size={14} className="text-indigo-400" />
      </button>
    </div>
  );
}
