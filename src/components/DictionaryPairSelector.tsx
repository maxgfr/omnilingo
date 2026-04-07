import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Download, Loader2, Trash2, Check } from "lucide-react";
import Fuse from "fuse.js";
import * as bridge from "../lib/bridge";
import type { LanguagePair, DictionarySource } from "../types";

interface Props {
  pairs: LanguagePair[];
  onDictionaryDownloaded: () => void;
}

export default function DictionaryPairSelector({ pairs, onDictionaryDownloaded }: Props) {
  const [dictSources, setDictSources] = useState<DictionarySource[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bridge.getAvailableDictionaries().then(setDictSources).catch(() => {});
  }, []);

  useEffect(() => {
    if (showSearch) inputRef.current?.focus();
  }, [showSearch]);

  const fuse = useMemo(
    () =>
      new Fuse(dictSources, {
        keys: ["source_name", "target_name", "source_lang", "target_lang"],
        threshold: 0.4,
      }),
    [dictSources],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    // Exact prefix match on lang codes and names first (handles "fr", "de", "en", etc.)
    const prefixMatches = dictSources.filter(
      (d) =>
        d.source_lang.toLowerCase().startsWith(q) ||
        d.target_lang.toLowerCase().startsWith(q) ||
        d.source_name.toLowerCase().startsWith(q) ||
        d.target_name.toLowerCase().startsWith(q),
    );
    if (prefixMatches.length > 0) return prefixMatches;
    // Fallback to fuzzy search
    return fuse.search(searchQuery).map((r) => r.item);
  }, [fuse, searchQuery, dictSources]);

  const existingKeys = new Set(pairs.map((p) => `${p.source_lang}-${p.target_lang}`));
  const filteredResults = searchResults.filter(
    (d) => !existingKeys.has(`${d.source_lang}-${d.target_lang}`),
  );

  const handleDownload = async (dict: DictionarySource) => {
    const key = `${dict.source_lang}-${dict.target_lang}`;
    setDownloading(key);
    setError(null);
    try {
      await bridge.downloadDictionary(
        dict.source_lang, dict.target_lang, dict.url,
        dict.source_name, dict.target_name, dict.format,
      );
      onDictionaryDownloaded();
      setSearchQuery("");
      setShowSearch(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (pairId: number) => {
    setDeleting(pairId);
    setError(null);
    try {
      await bridge.deleteLanguagePair(pairId);
      onDictionaryDownloaded();
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
                title="Delete this dictionary"
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

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Add dictionary button */}
      <button
        onClick={() => setShowSearch(!showSearch)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all w-full ${
          showSearch
            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400"
            : "bg-gray-50 dark:bg-gray-800 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
        }`}
      >
        <Search size={14} />
        <span>Add a dictionary</span>
      </button>

      {/* Search panel */}
      {showSearch && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dictionaries (e.g. English, German, fra, deu...)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />

          {filteredResults.length > 0 && (
            <div className="max-h-72 overflow-y-auto space-y-1">
              {filteredResults.map((dict) => {
                const key = `${dict.source_lang}-${dict.target_lang}`;
                const isDownloading = downloading === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleDownload(dict)}
                    disabled={isDownloading}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <span>{dict.source_flag}</span>
                      <span className="text-gray-900 dark:text-white font-medium">{dict.source_name}</span>
                      <span className="text-gray-400">{"\u2192"}</span>
                      <span>{dict.target_flag}</span>
                      <span className="text-gray-900 dark:text-white font-medium">{dict.target_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {dict.word_count && <span>{dict.word_count.toLocaleString()} words</span>}
                      {dict.size_mb && <span>{dict.size_mb} MB</span>}
                      {isDownloading ? (
                        <Loader2 size={14} className="animate-spin text-blue-500" />
                      ) : (
                        <Download size={14} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {searchQuery.trim() && filteredResults.length === 0 && !downloading && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
              {searchResults.length > 0 ? (
                <span className="flex items-center justify-center gap-1">
                  <Check size={12} className="text-emerald-500" />
                  All matching dictionaries already downloaded
                </span>
              ) : (
                "No matching dictionaries found"
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
