import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2, Plus } from "lucide-react";
import * as bridge from "../lib/bridge";
import type { LanguagePair } from "../types";
import LanguagePackDownloader from "./LanguagePackDownloader";

interface Props {
  pairs: LanguagePair[];
  onDictionaryDownloaded: () => Promise<void>;
}

export default function DictionaryPairSelector({ pairs, onDictionaryDownloaded }: Props) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (pairId: number) => {
    setDeleting(pairId);
    setError(null);
    try {
      await bridge.deleteLanguagePair(pairId);
      await onDictionaryDownloaded();
    } catch (err) {
      setError(String(err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Existing pairs with delete */}
      {pairs.length > 0 && (
        <div className="space-y-1.5">
          {(() => {
            const seen = new Set<number>();
            const grouped: Array<{ pair: LanguagePair; reverse?: LanguagePair }> = [];
            for (const pair of pairs) {
              if (seen.has(pair.id)) continue;
              seen.add(pair.id);
              const reverse = pairs.find(
                (p) => p.source_lang === pair.target_lang && p.target_lang === pair.source_lang && !seen.has(p.id),
              );
              if (reverse) seen.add(reverse.id);
              grouped.push({ pair, reverse });
            }
            return grouped.map(({ pair, reverse }) => (
              <div
                key={pair.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span>{pair.source_flag}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{pair.source_name}</span>
                  <span className="text-gray-400">{reverse ? "\u2194" : "\u2192"}</span>
                  <span>{pair.target_flag}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{pair.target_name}</span>
                </div>
                <button
                  onClick={async () => {
                    await handleDelete(pair.id);
                    if (reverse) await handleDelete(reverse.id);
                  }}
                  disabled={deleting === pair.id || (reverse ? deleting === reverse.id : false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  title={t("dictionary.deletePair")}
                >
                  {deleting === pair.id || (reverse && deleting === reverse.id) ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ));
          })()}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Add dictionary toggle */}
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

      {/* Language pack downloader */}
      {showAdd && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <LanguagePackDownloader
            existingPairs={pairs}
            onDownloaded={async () => {
              await onDictionaryDownloaded();
              setShowAdd(false);
            }}
            compact
          />
        </div>
      )}
    </div>
  );
}
