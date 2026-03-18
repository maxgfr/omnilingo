import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Sparkles, GraduationCap, Rocket, Globe, ChevronRight, Check, FileUp, Wand2, Download, Loader2 } from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import type { DictionarySource } from "../types";

interface OnboardingProps {
  children: React.ReactNode;
}

const LANGUAGES = [
  { code: "fr", code3: "fra", name: "Français", flag: "🇫🇷" },
  { code: "en", code3: "eng", name: "English", flag: "🇬🇧" },
  { code: "de", code3: "deu", name: "Deutsch", flag: "🇩🇪" },
  { code: "es", code3: "spa", name: "Español", flag: "🇪🇸" },
  { code: "it", code3: "ita", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", code3: "por", name: "Português", flag: "🇵🇹" },
  { code: "nl", code3: "nld", name: "Nederlands", flag: "🇳🇱" },
  { code: "ru", code3: "rus", name: "Русский", flag: "🇷🇺" },
  { code: "ja", code3: "jpn", name: "日本語", flag: "🇯🇵" },
  { code: "zh", code3: "zho", name: "中文", flag: "🇨🇳" },
  { code: "ko", code3: "kor", name: "한국어", flag: "🇰🇷" },
  { code: "ar", code3: "ara", name: "العربية", flag: "🇸🇦" },
  { code: "tr", code3: "tur", name: "Türkçe", flag: "🇹🇷" },
  { code: "pl", code3: "pol", name: "Polski", flag: "🇵🇱" },
  { code: "sv", code3: "swe", name: "Svenska", flag: "🇸🇪" },
];

const LEVELS = [
  { value: "A1", icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-700", hover: "hover:border-emerald-400" },
  { value: "A2", icon: GraduationCap, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-700", hover: "hover:border-blue-400" },
  { value: "B1", icon: Rocket, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-700", hover: "hover:border-amber-400" },
  { value: "B2", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-700", hover: "hover:border-purple-400" },
];

const AI_PROVIDERS = [
  { value: "claude-code", label: "Claude Code (local)", noKey: true },
  { value: "anthropic", label: "Anthropic", noKey: false },
  { value: "openai", label: "OpenAI", noKey: false },
  { value: "gemini", label: "Google Gemini", noKey: false },
  { value: "ollama", label: "Ollama (local)", noKey: true },
];

export default function Onboarding({ children }: OnboardingProps) {
  const { t } = useTranslation();
  const { activePair, reloadSettings, updateSetting } = useApp();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [nativeLang, setNativeLang] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<string | null>(null);
  const [availableDicts, setAvailableDicts] = useState<DictionarySource[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadDone, setDownloadDone] = useState(false);
  const [aiProvider, setAiProvider] = useState("claude-code");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiTestStatus, setAiTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [aiTestError, setAiTestError] = useState("");

  useEffect(() => {
    if (!activePair) {
      setNeedsOnboarding(true);
      return;
    }
    bridge.getWordCount(activePair.id).then((count) => {
      setNeedsOnboarding(count === 0);
    }).catch(() => setNeedsOnboarding(true));
  }, [activePair]);

  // Load dictionary catalog
  useEffect(() => {
    bridge.getAvailableDictionaries().then(setAvailableDicts).catch(() => {});
  }, []);

  if (needsOnboarding === null) return null;
  if (!needsOnboarding) return <>{children}</>;

  const handleSelectLevel = async (level: string) => {
    try {
      await updateSetting("level", level);
      const pairs = await bridge.getLanguagePairs();
      const matchingPair = pairs.find(
        (p) => p.source_lang === nativeLang && p.target_lang === targetLang
      ) || pairs.find(
        (p) => p.source_lang === targetLang && p.target_lang === nativeLang
      ) || pairs[0];
      if (matchingPair) {
        await bridge.setActiveLanguagePair(matchingPair.id);
      }
      await reloadSettings();
      setStep(4);
    } catch (err) {
      console.error("Onboarding failed:", err);
      setStep(4);
    }
  };

  const handleTestAi = async () => {
    setAiTestStatus("testing");
    setAiTestError("");
    try {
      const provider = AI_PROVIDERS.find(p => p.value === aiProvider);
      await bridge.setAiProvider(aiProvider, provider?.noKey ? "" : aiApiKey, "");
      await bridge.askAi("Reply with only the word OK");
      setAiTestStatus("ok");
    } catch (err) {
      setAiTestStatus("error");
      setAiTestError(String(err));
    }
  };

  const handleSaveAi = async () => {
    try {
      const provider = AI_PROVIDERS.find(p => p.value === aiProvider);
      await bridge.setAiProvider(aiProvider, provider?.noKey ? "" : aiApiKey, "");
    } catch { /* ignore */ }
    setStep(5);
  };

  const handleImportFile = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.tsv,.json,.txt,.tab,.df";
    input.onchange = async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        let fmt = "tsv";
        if (ext === "csv") fmt = "csv";
        else if (ext === "json") fmt = "json";
        const pairs = await bridge.getLanguagePairs();
        const pair = pairs[0];
        if (pair) {
          await bridge.importFromFile(pair.id, text, fmt);
        }
        await reloadSettings();
        setNeedsOnboarding(false);
      } catch (err) {
        console.error("Import failed:", err);
      }
    };
    input.click();
  };

  const handleDownloadDict = async (dict: DictionarySource) => {
    const key = `${dict.source_lang}-${dict.target_lang}`;
    setDownloading(key);
    try {
      await bridge.downloadDictionary(
        dict.source_lang, dict.target_lang, dict.url,
        dict.source_name, dict.target_name
      );
      await reloadSettings();
      setDownloadDone(true);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(null);
    }
  };

  const handleSkip = () => setNeedsOnboarding(false);
  const handleFinish = () => setNeedsOnboarding(false);

  const totalSteps = 6;
  const targetOptions = LANGUAGES.filter((l) => l.code !== nativeLang);

  const [dictSearch, setDictSearch] = useState("");

  // Sort dictionaries: exact pair match first, then partial, then rest
  const nativeLang3 = LANGUAGES.find(l => l.code === nativeLang)?.code3 || "";
  const targetLang3 = LANGUAGES.find(l => l.code === targetLang)?.code3 || "";
  const filteredDicts = availableDicts
    .filter(d => {
      if (!dictSearch.trim()) return true;
      const q = dictSearch.toLowerCase();
      return d.source_name.toLowerCase().includes(q) || d.target_name.toLowerCase().includes(q) ||
        d.source_lang.toLowerCase().includes(q) || d.target_lang.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const scoreA = (a.source_lang === targetLang3 && a.target_lang === nativeLang3) || (a.source_lang === nativeLang3 && a.target_lang === targetLang3) ? 0 :
        (a.source_lang === targetLang3 || a.target_lang === targetLang3 || a.source_lang === nativeLang3 || a.target_lang === nativeLang3) ? 1 : 2;
      const scoreB = (b.source_lang === targetLang3 && b.target_lang === nativeLang3) || (b.source_lang === nativeLang3 && b.target_lang === targetLang3) ? 0 :
        (b.source_lang === targetLang3 || b.target_lang === targetLang3 || b.source_lang === nativeLang3 || b.target_lang === nativeLang3) ? 1 : 2;
      return scoreA - scoreB;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center gap-2 pt-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all duration-300 ${
              i === step ? "w-8 bg-amber-500" : i < step ? "w-2 bg-amber-300 dark:bg-amber-600" : "w-2 bg-gray-200 dark:bg-gray-700"
            }`} />
          ))}
        </div>

        <div className="p-8">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30">
                <Sparkles size={36} className="text-white" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t("onboarding.welcome")}</h1>
                <p className="text-gray-500 dark:text-gray-400 text-lg">{t("onboarding.subtitle")}</p>
              </div>
              <button onClick={() => setStep(1)} className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-md transition-all hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
                {t("onboarding.getStarted")}
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* Step 1: Native language */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <Globe size={32} className="mx-auto text-amber-500 mb-2" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("onboarding.selectNative")}</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {LANGUAGES.map((lang) => (
                  <button key={lang.code} onClick={() => { setNativeLang(lang.code); setStep(2); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border-gray-200 dark:border-gray-700 hover:border-amber-300">
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Target language */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <BookOpen size={32} className="mx-auto text-blue-500 mb-2" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("onboarding.selectTarget")}</h2>
                <p className="text-sm text-gray-400">
                  {LANGUAGES.find(l => l.code === nativeLang)?.flag} {LANGUAGES.find(l => l.code === nativeLang)?.name} → ?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {targetOptions.map((lang) => (
                  <button key={lang.code} onClick={() => { setTargetLang(lang.code); setStep(3); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border-gray-200 dark:border-gray-700 hover:border-blue-300">
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{lang.name}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">← {t("common.back")}</button>
            </div>
          )}

          {/* Step 3: Level */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("onboarding.selectLevel")}</h2>
                <p className="text-sm text-gray-400">
                  {LANGUAGES.find(l => l.code === nativeLang)?.flag} → {LANGUAGES.find(l => l.code === targetLang)?.flag} {LANGUAGES.find(l => l.code === targetLang)?.name}
                </p>
              </div>
              <div className="space-y-3">
                {LEVELS.map((level) => (
                  <button key={level.value} onClick={() => handleSelectLevel(level.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 ${level.border} ${level.bg} ${level.hover} transition-all hover:shadow-md active:scale-[0.99]`}>
                    <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-white dark:bg-gray-800 shadow-sm ${level.color}`}>
                      <level.icon size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900 dark:text-white">{level.value}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {level.value === "A1" ? t("onboarding.beginner") : level.value === "A2" ? t("onboarding.elementary") : level.value === "B1" ? t("onboarding.intermediate") : t("onboarding.upperIntermediate")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">← {t("common.back")}</button>
            </div>
          )}

          {/* Step 4: AI setup */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <Wand2 size={32} className="mx-auto text-purple-500 mb-2" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("onboarding.aiSetup")}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("onboarding.aiSetupDescription")}</p>
              </div>
              <div className="space-y-3">
                {AI_PROVIDERS.map((provider) => (
                  <button key={provider.value} onClick={() => { setAiProvider(provider.value); setAiTestStatus("idle"); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                      aiProvider === provider.value
                        ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-purple-300"
                    }`}>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{provider.label}</span>
                    {provider.noKey && <span className="text-xs text-gray-400">{t("onboarding.noKeyNeeded")}</span>}
                    {aiProvider === provider.value && <Check size={16} className="text-purple-500" />}
                  </button>
                ))}
              </div>
              {!AI_PROVIDERS.find(p => p.value === aiProvider)?.noKey && (
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={t("onboarding.apiKey")}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              )}
              <button onClick={handleTestAi} disabled={aiTestStatus === "testing" || (!AI_PROVIDERS.find(p => p.value === aiProvider)?.noKey && !aiApiKey.trim())}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-purple-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {aiTestStatus === "testing" ? <><Loader2 size={16} className="animate-spin" /> Testing...</> :
                 aiTestStatus === "ok" ? <><Check size={16} className="text-emerald-500" /> Connection OK</> :
                 aiTestStatus === "error" ? <span className="text-red-500 text-xs truncate max-w-full">{aiTestError}</span> :
                 "Test connection"}
              </button>
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">← {t("common.back")}</button>
                <button onClick={handleSaveAi} className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-xl transition-all">
                  {t("onboarding.getStarted")}
                  <ChevronRight size={18} className="inline ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Get content */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
                  <Download size={32} className="text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("onboarding.addContent")}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("onboarding.addContentDescription")}</p>
              </div>

              {downloadDone ? (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 p-4 text-center">
                  <Check size={24} className="text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t("onboarding.dictDownloaded")}</p>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={dictSearch}
                    onChange={(e) => setDictSearch(e.target.value)}
                    placeholder="Search dictionaries..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filteredDicts.length === 0 ? (
                      <p className="text-center text-sm text-gray-400 py-4">No dictionaries found</p>
                    ) : (
                      filteredDicts.map((dict) => {
                        const key = `${dict.source_lang}-${dict.target_lang}`;
                        return (
                          <button key={key} onClick={() => handleDownloadDict(dict)} disabled={downloading !== null}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 transition-all text-left disabled:opacity-50">
                            <div className="flex items-center gap-2">
                              <span>{dict.source_flag}</span>
                              <span className="text-xs text-gray-400">→</span>
                              <span>{dict.target_flag}</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{dict.source_name} → {dict.target_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {dict.word_count && <span className="text-xs text-gray-400">{dict.word_count.toLocaleString()}</span>}
                              {downloading === key ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <Download size={14} className="text-blue-500" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              <button onClick={handleImportFile}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 hover:border-indigo-400 transition-all hover:shadow-md active:scale-[0.99]">
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-gray-800 shadow-sm text-indigo-500">
                  <FileUp size={20} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{t("onboarding.importDict")}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("onboarding.importDictDescription")}</p>
                </div>
              </button>

              <div className="flex gap-3">
                <button onClick={() => setStep(4)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">← {t("common.back")}</button>
                {downloadDone ? (
                  <button onClick={handleFinish} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium text-sm transition-all">
                    {t("onboarding.getStarted")}
                  </button>
                ) : (
                  <button onClick={handleSkip} className="flex-1 text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-2.5">
                    {t("onboarding.skipForNow")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
