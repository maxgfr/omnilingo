import { useState, Suspense, lazy, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Languages, BookMarked, SpellCheck, RefreshCw, Table,
  ArrowRightLeft, BookOpen, CalendarDays, Wrench,
  BookOpenCheck, Mic, Loader2, Clock,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { getSearchHistory } from "../lib/ai-cache";
import WordActionBar from "../components/tools/WordActionBar";

// Lazy-loaded tools
const TranslateTool = lazy(() => import("../components/tools/TranslateTool"));
const ContextTool = lazy(() => import("../components/tools/ContextTool"));
const CorrectorTool = lazy(() => import("../components/tools/CorrectorTool"));
const RephraseTool = lazy(() => import("../components/tools/RephraseTool"));
const ConjugateTool = lazy(() => import("../components/tools/ConjugateTool"));
const SynonymsTool = lazy(() => import("../components/tools/SynonymsTool"));
const DefinitionTool = lazy(() => import("../components/tools/DefinitionTool"));
const DailyWordsTool = lazy(() => import("../components/tools/DailyWordsTool"));
const ReaderTool = lazy(() => import("../components/tools/ReaderTool"));
const PronunciationTool = lazy(() => import("../components/tools/PronunciationTool"));

type ToolTab = "translate" | "context" | "corrector" | "rephrase" | "conjugate" | "synonyms" | "definition" | "daily" | "reader" | "pronunciation";

const TOOL_TABS: { key: ToolTab; icon: React.ComponentType<{ size?: number; className?: string }>; labelKey: string }[] = [
  { key: "translate", icon: Languages, labelKey: "tools.tabs.translate" },
  { key: "context", icon: BookMarked, labelKey: "tools.tabs.context" },
  { key: "corrector", icon: SpellCheck, labelKey: "tools.tabs.corrector" },
  { key: "rephrase", icon: RefreshCw, labelKey: "tools.tabs.rephrase" },
  { key: "conjugate", icon: Table, labelKey: "tools.tabs.conjugate" },
  { key: "synonyms", icon: ArrowRightLeft, labelKey: "tools.tabs.synonyms" },
  { key: "definition", icon: BookOpen, labelKey: "tools.tabs.definition" },
  { key: "reader", icon: BookOpenCheck, labelKey: "tools.tabs.reader" },
  { key: "pronunciation", icon: Mic, labelKey: "tools.tabs.pronunciation" },
  { key: "daily", icon: CalendarDays, labelKey: "tools.tabs.daily" },
];

const WORD_TOOLS: ToolTab[] = ["context", "definition", "synonyms", "conjugate"];

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  );
}

export default function Tools() {
  const { t } = useTranslation();
  const { activePair } = useApp();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as ToolTab) || "translate";
  const [activeTab, setActiveTab] = useState<ToolTab>(
    TOOL_TABS.some((tab) => tab.key === initialTab) ? initialTab : "translate",
  );
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [initialWord, setInitialWord] = useState<string | undefined>(undefined);
  const [navCounter, setNavCounter] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  const navigateTo = useCallback((tab: ToolTab, word: string) => {
    setActiveTab(tab);
    setInitialWord(word);
    setNavCounter((c) => c + 1);
    setSelectedWord(null);
  }, []);

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord(word);
  }, []);

  const handleTabChange = useCallback((tab: ToolTab) => {
    setActiveTab(tab);
    setInitialWord(undefined);
    setSelectedWord(null);
  }, []);

  const history = activePair ? getSearchHistory(activePair.id) : [];
  const recentForTab = history.filter((h) => WORD_TOOLS.includes(h.tool as ToolTab)).slice(0, 6);

  if (!activePair) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        {t("dashboard.noActivePair")}
      </div>
    );
  }

  const toolProps = { onWordClick: handleWordClick, initialWord, key: `${activeTab}-${navCounter}` };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
          <Wrench size={20} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t("tools.title")}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("tools.subtitle")}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl min-w-max">
          {TOOL_TABS.map(({ key, icon: Icon, labelKey }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                activeTab === key
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50"
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{t(labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Word action bar */}
      {selectedWord && (
        <WordActionBar
          word={selectedWord}
          onNavigate={navigateTo}
          onClose={() => setSelectedWord(null)}
        />
      )}

      {/* Recent history */}
      {WORD_TOOLS.includes(activeTab) && recentForTab.length > 0 && !initialWord && (
        <div className="relative">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <Clock size={12} />
            {t("tools.recentSearches")}
          </button>
          {showHistory && (
            <div className="flex flex-wrap gap-1.5 mt-2 animate-fadeIn">
              {recentForTab.map((h, i) => (
                <button
                  key={i}
                  onClick={() => { navigateTo(activeTab, h.query); setShowHistory(false); }}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 transition-colors"
                >
                  {h.query}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active tool */}
      <Suspense fallback={<LoadingFallback />}>
        {activeTab === "translate" && <TranslateTool {...toolProps} />}
        {activeTab === "context" && <ContextTool {...toolProps} />}
        {activeTab === "corrector" && <CorrectorTool {...toolProps} />}
        {activeTab === "rephrase" && <RephraseTool {...toolProps} />}
        {activeTab === "conjugate" && <ConjugateTool {...toolProps} />}
        {activeTab === "synonyms" && <SynonymsTool {...toolProps} />}
        {activeTab === "definition" && <DefinitionTool {...toolProps} />}
        {activeTab === "daily" && <DailyWordsTool key="daily" />}
        {activeTab === "reader" && <ReaderTool {...toolProps} />}
        {activeTab === "pronunciation" && <PronunciationTool key="pronunciation" />}
      </Suspense>
    </div>
  );
}
