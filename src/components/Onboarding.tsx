import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Loader2, Sparkles, GraduationCap, Rocket } from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";

interface OnboardingProps {
  children: React.ReactNode;
}

const levels = [
  {
    value: "A1",
    icon: BookOpen,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-700",
    hoverBorder: "hover:border-emerald-400 dark:hover:border-emerald-500",
    ring: "ring-emerald-500",
  },
  {
    value: "A2",
    icon: GraduationCap,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-700",
    hoverBorder: "hover:border-blue-400 dark:hover:border-blue-500",
    ring: "ring-blue-500",
  },
  {
    value: "B1",
    icon: Rocket,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-700",
    hoverBorder: "hover:border-amber-400 dark:hover:border-amber-500",
    ring: "ring-amber-500",
  },
] as const;

export default function Onboarding({ children }: OnboardingProps) {
  const { t } = useTranslation();
  const { activePair, reloadSettings, updateSetting } = useApp();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    if (!activePair) {
      setNeedsOnboarding(true);
      return;
    }
    bridge
      .getWordCount(activePair.id)
      .then((count) => {
        setNeedsOnboarding(count === 0);
      })
      .catch(() => setNeedsOnboarding(true));
  }, [activePair]);

  if (needsOnboarding === null) return null;
  if (!needsOnboarding) return <>{children}</>;

  const handleSelectLevel = async (level: string) => {
    await updateSetting("level", level);
    setStep(2);
    setImporting(true);
    setImportStatus(t("common.loading"));
    try {
      if (activePair) {
        const result = await bridge.importBuiltinData(activePair.id);
        setImportStatus(result);
      }
      await reloadSettings();
      // Brief pause so the user sees the success state
      await new Promise((r) => setTimeout(r, 800));
      setNeedsOnboarding(false);
    } catch (err) {
      console.error("Import failed:", err);
      setNeedsOnboarding(false);
    } finally {
      setImporting(false);
    }
  };

  const levelLabels: Record<string, string> = {
    A1: t("onboarding.beginner"),
    A2: t("onboarding.elementary"),
    B1: t("onboarding.intermediate"),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 dark:from-amber-900 dark:via-orange-900 dark:to-rose-900">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-8 bg-amber-500"
                  : i < step
                    ? "w-2 bg-amber-300 dark:bg-amber-600"
                    : "w-2 bg-gray-200 dark:bg-gray-700"
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {t("onboarding.welcome")}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  {t("onboarding.subtitle")}
                </p>
              </div>

              {activePair && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300">
                  <span>{activePair.source_flag}</span>
                  <span className="font-medium">{activePair.source_name}</span>
                  <span className="text-gray-400">&rarr;</span>
                  <span>{activePair.target_flag}</span>
                  <span className="font-medium">{activePair.target_name}</span>
                </div>
              )}

              <button
                onClick={() => setStep(1)}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-md shadow-amber-500/25 transition-all hover:shadow-lg hover:shadow-amber-500/30 active:scale-[0.98]"
              >
                {t("onboarding.getStarted")}
              </button>
            </div>
          )}

          {/* Step 1: Level selection */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {t("onboarding.selectLevel")}
                </h2>
              </div>

              <div className="space-y-3">
                {levels.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => handleSelectLevel(level.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 ${level.border} ${level.bg} ${level.hoverBorder} transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 ${level.ring} focus:ring-offset-2 dark:focus:ring-offset-gray-900`}
                  >
                    <div
                      className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-white dark:bg-gray-800 shadow-sm ${level.color}`}
                    >
                      <level.icon size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900 dark:text-white">
                        {level.value}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {levelLabels[level.value]}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Importing */}
          {step === 2 && (
            <div className="text-center space-y-6 py-8">
              {importing ? (
                <>
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-900/30">
                    <Loader2
                      size={40}
                      className="text-amber-500 animate-spin"
                    />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {t("settings.importBuiltinData")}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {importStatus}
                    </p>
                  </div>

                  {/* Animated progress bar */}
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-xs mx-auto">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse w-3/4 transition-all duration-1000" />
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/30">
                    <Sparkles size={40} className="text-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {importStatus}
                    </h2>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
