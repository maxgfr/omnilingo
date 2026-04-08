import { useMemo } from "react";
import { Clock } from "lucide-react";
import { getSearchHistory } from "../../lib/ai-cache";

interface RecentSearchesProps {
  tool: string;
  pairId: number;
  onSelect: (query: string) => void;
  visible: boolean;
}

export default function RecentSearches({ tool, pairId, onSelect, visible }: RecentSearchesProps) {
  const entries = useMemo(() => {
    if (!visible) return [];
    return getSearchHistory(pairId)
      .filter((h) => h.tool === tool)
      .slice(0, 8);
  }, [tool, pairId, visible]);

  if (!visible || entries.length === 0) return null;

  return (
    <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
      <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Historique</span>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {entries.map((entry, i) => (
          <button
            key={`${entry.query}-${i}`}
            onClick={() => onSelect(entry.query)}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center gap-2"
          >
            <Clock size={12} className="text-gray-400 flex-shrink-0" />
            <span className="truncate">{entry.query}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
