import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Loader2, Sparkles, GraduationCap, Rocket, Globe, ChevronRight, Check } from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";

interface OnboardingProps {
  children: React.ReactNode;
}

const LANGUAGES = [
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "sv", name: "Svenska", flag: "🇸🇪" },
];

const LEVELS = [
  { value: "A1", icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-700", hover: "hover:border-emerald-400" },
  { value: "A2", icon: GraduationCap, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-700", hover: "hover:border-blue-400" },
  { value: "B1", icon: Rocket, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-700", hover: "hover:border-amber-400" },
];

export default function Onboarding({ children }: OnboardingProps) {
  const { t } = useTranslation();
  const { activePair, reloadSettings, updateSetting } = useApp();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [step, setStep] = useState(0); // 0=welcome, 1=native lang, 2=target lang, 3=level, 4=importing
  const [nativeLang, setNativeLang] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<string | null>(null);
  const [, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);

  useEffect(() => {
    if (!activePair) {
      setNeedsOnboarding(true);
      return;
    }
    bridge.getWordCount(activePair.id).then((count) => {
      setNeedsOnboarding(count === 0);
    }).catch(() => setNeedsOnboarding(true));
  }, [activePair]);

  if (needsOnboarding === null) return null;
  if (!needsOnboarding) return <>{children}</>;

  const handleSelectLevel = async (level: string) => {
    setStep(4);
    setImporting(true);
    try {
      await updateSetting("level", level);
      // If a pair was created via download or if the default DE-FR pair exists, import data
      const pairs = await bridge.getLanguagePairs();
      const matchingPair = pairs.find(
        (p) => p.source_lang === targetLang && p.target_lang === nativeLang
      ) || pairs[0];

      if (matchingPair) {
        await bridge.setActiveLanguagePair(matchingPair.id);
        await bridge.importBuiltinData(matchingPair.id).catch(() => {});
      }
      await reloadSettings();
      setImportDone(true);
      await new Promise((r) => setTimeout(r, 1000));
      setNeedsOnboarding(false);
    } catch (err) {
      console.error("Onboarding failed:", err);
      setNeedsOnboarding(false);
    } finally {
      setImporting(false);
    }
  };

  const totalSteps = 5;
  const targetOptions = LANGUAGES.filter((l) => l.code !== nativeLang);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Decorative */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-amber-500" : i < step ? "w-2 bg-amber-300 dark:bg-amber-600" : "w-2 bg-gray-200 dark:bg-gray-700"
              }`}
            />
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
              <button
                onClick={() => setStep(1)}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-md transition-all hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
              >
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
                  <button
                    key={lang.code}
                    onClick={() => { setNativeLang(lang.code); setStep(2); }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                      nativeLang === lang.code
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600"
                    }`}
                  >
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
                  {LANGUAGES.find((l) => l.code === nativeLang)?.flag} {LANGUAGES.find((l) => l.code === nativeLang)?.name} →  ?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {targetOptions.map((lang) => {
                  const isBuiltin = (lang.code === "de" && nativeLang === "fr") || (lang.code === "fr" && nativeLang === "de");
                  return (
                    <button
                      key={lang.code}
                      onClick={() => { setTargetLang(lang.code); setStep(3); }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] relative ${
                        targetLang === lang.code
                          ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
                      }`}
                    >
                      <span className="text-2xl">{lang.flag}</span>
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white block">{lang.name}</span>
                        {isBuiltin && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">500+ words built-in</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                ← {t("common.back")}
              </button>
            </div>
          )}

          {/* Step 3: Level */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("onboarding.selectLevel")}</h2>
                <p className="text-sm text-gray-400">
                  {LANGUAGES.find((l) => l.code === nativeLang)?.flag} → {LANGUAGES.find((l) => l.code === targetLang)?.flag} {LANGUAGES.find((l) => l.code === targetLang)?.name}
                </p>
              </div>
              <div className="space-y-3">
                {LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => handleSelectLevel(level.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 ${level.border} ${level.bg} ${level.hover} transition-all hover:shadow-md active:scale-[0.99]`}
                  >
                    <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-white dark:bg-gray-800 shadow-sm ${level.color}`}>
                      <level.icon size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900 dark:text-white">{level.value}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {level.value === "A1" ? t("onboarding.beginner") : level.value === "A2" ? t("onboarding.elementary") : t("onboarding.intermediate")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                ← {t("common.back")}
              </button>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 4 && (
            <div className="text-center space-y-6 py-8">
              {!importDone ? (
                <>
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-900/30">
                    <Loader2 size={40} className="text-amber-500 animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("settings.importBuiltinData")}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("common.loading")}</p>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-xs mx-auto">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse w-3/4" />
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/30">
                    <Check size={40} className="text-emerald-500" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {LANGUAGES.find((l) => l.code === nativeLang)?.flag} → {LANGUAGES.find((l) => l.code === targetLang)?.flag}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("onboarding.getStarted")}!</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
