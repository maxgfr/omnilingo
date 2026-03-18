import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Sparkles, GraduationCap, Rocket, Globe, ChevronRight, Check, FileUp, Wand2 } from "lucide-react";
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
  const [step, setStep] = useState(0);
  const [nativeLang, setNativeLang] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<string | null>(null);

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
    try {
      await updateSetting("level", level);
      const pairs = await bridge.getLanguagePairs();
      const matchingPair = pairs.find(
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

  const handleGenerateAi = async () => {
    try {
      const pairs = await bridge.getLanguagePairs();
      const pair = pairs[0];
      if (!pair) return;

      const sourceName = LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
      const targetName = LANGUAGES.find(l => l.code === nativeLang)?.name || nativeLang;

      const prompt = `Generate a JSON array of 50 common words for a ${sourceName} to ${targetName} language learner at A1-A2 level.
Each word should be an object with: "source_word" (in ${sourceName}), "target_word" (in ${targetName}), "level" (A1 or A2), "category" (food, animals, colors, numbers, greetings, family, body, travel, etc).
Return ONLY valid JSON array, no markdown, no explanation.`;

      const response = await bridge.askAi(prompt);
      let jsonStr = response.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      await bridge.importFromFile(pair.id, jsonStr, "json");
      await reloadSettings();
      setNeedsOnboarding(false);
    } catch (err) {
      console.error("AI generation failed:", err);
      // Let user continue anyway
      setNeedsOnboarding(false);
    }
  };

  const handleSkip = () => {
    setNeedsOnboarding(false);
  };

  const totalSteps = 5;
  const targetOptions = LANGUAGES.filter((l) => l.code !== nativeLang);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
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
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600"
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
                  {LANGUAGES.find((l) => l.code === nativeLang)?.flag} {LANGUAGES.find((l) => l.code === nativeLang)?.name} → ?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {targetOptions.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { setTargetLang(lang.code); setStep(3); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
                  >
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{lang.name}</span>
                  </button>
                ))}
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

          {/* Step 4: Import content */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
                  <Check size={32} className="text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t("onboarding.addContent")}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("onboarding.addContentDescription")}</p>
              </div>

              <div className="space-y-3">
                {/* Import dictionary file */}
                <button
                  onClick={handleImportFile}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 hover:border-indigo-400 transition-all hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-white dark:bg-gray-800 shadow-sm text-indigo-500">
                    <FileUp size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900 dark:text-white">{t("onboarding.importDict")}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("onboarding.importDictDescription")}</p>
                  </div>
                </button>

                {/* Generate with AI */}
                <button
                  onClick={handleGenerateAi}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 hover:border-purple-400 transition-all hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-white dark:bg-gray-800 shadow-sm text-purple-500">
                    <Wand2 size={24} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900 dark:text-white">{t("onboarding.generateAi")}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t("onboarding.generateAiDescription")}</p>
                  </div>
                </button>
              </div>

              {/* Skip */}
              <button onClick={handleSkip} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-2">
                {t("onboarding.skipForNow")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
