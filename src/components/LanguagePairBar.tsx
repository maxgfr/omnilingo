import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import type { LanguagePair } from "../types";

interface Props {
  pairs: LanguagePair[];
  activePairId: number | null;
  onSwitch: (id: number) => void;
}

export default function LanguagePairBar({ pairs, activePairId, onSwitch }: Props) {
  if (pairs.length === 0) {
    return (
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No language pairs available.{" "}
          <Link to="/settings" className="text-amber-600 dark:text-amber-400 hover:underline font-medium">
            Download a dictionary in Settings
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="relative inline-block mb-4">
      <select
        value={activePairId ?? ""}
        onChange={(e) => onSwitch(Number(e.target.value))}
        className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 cursor-pointer"
      >
        {pairs.map((pair) => (
          <option key={pair.id} value={pair.id}>
            {pair.source_name} {pair.source_flag} → {pair.target_flag} {pair.target_name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
    </div>
  );
}
