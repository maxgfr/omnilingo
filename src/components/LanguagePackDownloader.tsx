import { useState, useEffect, useMemo } from "react";
import { Download, Loader2, ChevronDown, Check, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import * as bridge from "../lib/bridge";
import type { LanguagePair, DictionarySource } from "../types";

interface Props {
  existingPairs: LanguagePair[];
  onDownloaded: () => Promise<void>;
  compact?: boolean;
}

interface LangOption {
  code: string;
  name: string;
  flag: string;
}

export default function LanguagePackDownloader({ existingPairs, onDownloaded, compact }: Props) {
  const { t } = useTranslation();
  const switchPair = useAppStore((s) => s.switchPair);

  const [dictSources, setDictSources] = useState<DictionarySource[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    bridge.getAvailableDictionaries().then(setDictSources).catch(() => {});
  }, []);

  const existingKeys = useMemo(
    () => new Set(existingPairs.map((p) => `${p.source_lang}-${p.target_lang}`)),
    [existingPairs],
  );

  // Unique source languages, sorted by name
  const sourceLanguages = useMemo<LangOption[]>(() => {
    const map = new Map<string, LangOption>();
    for (const d of dictSources) {
      if (!map.has(d.source_lang)) {
        map.set(d.source_lang, { code: d.source_lang, name: d.source_name, flag: d.source_flag });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [dictSources]);

  // Target languages filtered by selected source, sorted by name
  const targetLanguages = useMemo<LangOption[]>(() => {
    if (!selectedSource) return [];
    const map = new Map<string, LangOption>();
    for (const d of dictSources) {
      if (d.source_lang === selectedSource && !map.has(d.target_lang)) {
        map.set(d.target_lang, { code: d.target_lang, name: d.target_name, flag: d.target_flag });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [dictSources, selectedSource]);

  // Best dictionary for the selected pair (highest word_count)
  const selectedDict = useMemo<DictionarySource | null>(() => {
    if (!selectedSource || !selectedTarget) return null;
    const matches = dictSources.filter(
      (d) => d.source_lang === selectedSource && d.target_lang === selectedTarget,
    );
    if (matches.length === 0) return null;
    return matches.reduce((best, d) =>
      (d.word_count ?? 0) > (best.word_count ?? 0) ? d : best,
    );
  }, [dictSources, selectedSource, selectedTarget]);

  // Check if this pair is already downloaded
  const alreadyDownloaded = selectedSource && selectedTarget
    ? existingKeys.has(`${selectedSource}-${selectedTarget}`)
    : false;

  const handleDownload = async () => {
    if (!selectedDict) return;
    setDownloading(true);
    setError(null);
    setSuccess(false);
    try {
      await bridge.downloadDictionary(
        selectedDict.source_lang, selectedDict.target_lang, selectedDict.url,
        selectedDict.source_name, selectedDict.target_name, selectedDict.format,
      );

      // Auto-download reverse pair (best-effort)
      const reverseMatches = dictSources.filter(
        (d) => d.source_lang === selectedTarget && d.target_lang === selectedSource,
      );
      if (reverseMatches.length > 0 && !existingKeys.has(`${selectedTarget}-${selectedSource}`)) {
        const best = reverseMatches.reduce((b, d) =>
          (d.word_count ?? 0) > (b.word_count ?? 0) ? d : b,
        );
        try {
          await bridge.downloadDictionary(
            best.source_lang, best.target_lang, best.url,
            best.source_name, best.target_name, best.format,
          );
        } catch {
          // Reverse is best-effort
        }
      }

      await onDownloaded();

      // Auto-select the new pair
      const pairs = useAppStore.getState().languagePairs;
      const newPair = pairs.find(
        (p) => p.source_lang === selectedSource && p.target_lang === selectedTarget,
      );
      if (newPair) switchPair(newPair.id);

      setSuccess(true);
      setSelectedSource(null);
      setSelectedTarget(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleSourceChange = (code: string) => {
    setSelectedSource(code || null);
    setSelectedTarget(null);
    setError(null);
    setSuccess(false);
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {/* Two dropdowns side by side */}
      <div className={`flex gap-3 ${compact ? "flex-col sm:flex-row" : "flex-col sm:flex-row"}`}>
        {/* Source language */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            {t("dictionary.selectSourceLang")}
          </label>
          <div className="relative">
            <select
              value={selectedSource ?? ""}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
            >
              <option value="">{t("dictionary.selectSourceLang")}...</option>
              {sourceLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        {/* Target language */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            {t("dictionary.selectTargetLang")}
          </label>
          <div className="relative">
            <select
              value={selectedTarget ?? ""}
              onChange={(e) => {
                setSelectedTarget(e.target.value || null);
                setError(null);
                setSuccess(false);
              }}
              disabled={!selectedSource}
              className="w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{t("dictionary.selectTargetLang")}...</option>
              {targetLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Info card + download button */}
      {selectedDict && !alreadyDownloaded && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Globe size={14} className="text-gray-400" />
              <span className="font-medium">{selectedDict.source_name}</span>
              <span className="text-gray-400">{"\u2194"}</span>
              <span className="font-medium">{selectedDict.target_name}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              {selectedDict.word_count && (
                <span>{selectedDict.word_count.toLocaleString()} {t("common.words").toLowerCase()}</span>
              )}
              {selectedDict.size_mb && <span>{selectedDict.size_mb} MB</span>}
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("dictionary.downloadingPack")}
              </>
            ) : (
              <>
                <Download size={16} />
                {t("dictionary.downloadBothDirections")}
              </>
            )}
          </button>
        </div>
      )}

      {/* Already downloaded */}
      {alreadyDownloaded && selectedSource && selectedTarget && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
          <Check size={14} />
          {t("common.installed")}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
          <Check size={14} />
          {t("dictionary.packDownloaded")}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
