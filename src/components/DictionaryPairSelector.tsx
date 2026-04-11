import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2, Plus, Check, ChevronDown } from "lucide-react";
import * as bridge from "../lib/bridge";
import type { LanguagePair } from "../types";
import { LANGUAGES } from "../lib/languages";
import { useAppStore } from "../store/useAppStore";

interface Props {
  pairs: LanguagePair[];
  onChange: () => Promise<void>;
}

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

  const targetOptions = useMemo(
    () => LANGUAGES.filter((l) => l.code !== sourceCode),
    [sourceCode],
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
      // Create both directions so reverse-pair lookups work everywhere.
      const newId = await bridge.createLanguagePair(
        src.code, src.name, src.flag,
        tgt.code, tgt.name, tgt.flag,
      );
      await bridge.createLanguagePair(
        tgt.code, tgt.name, tgt.flag,
        src.code, src.name, src.flag,
      );
      await onChange();

      // Auto-activate the newly created (forward) pair so the rest of the
      // app immediately reflects it.
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
            {/* Source language */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                {t("dictionary.sourceLanguage")}
              </label>
              <div className="relative">
                <select
                  value={sourceCode}
                  onChange={(e) => {
                    setSourceCode(e.target.value);
                    if (e.target.value === targetCode) setTargetCode("");
                  }}
                  className="w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all"
                >
                  <option value="">{t("dictionary.sourceLanguage")}…</option>
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Target language */}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                {t("dictionary.targetLanguage")}
              </label>
              <div className="relative">
                <select
                  value={targetCode}
                  onChange={(e) => setTargetCode(e.target.value)}
                  disabled={!sourceCode}
                  className="w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{t("dictionary.targetLanguage")}…</option>
                  {targetOptions.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
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
