import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { useFeaturePair } from "../lib/useFeaturePair";
import { useAppStore, selectIsAiConfigured } from "../store/useAppStore";
import PageHeader from "../components/ui/PageHeader";
import SentenceMiningTool from "../components/tools/SentenceMiningTool";

export default function TextAnalysis() {
  const { t } = useTranslation();
  const { activePair } = useFeaturePair("text-analysis");
  const isAiConfigured = useAppStore(selectIsAiConfigured);
  const cachedInput = useAppStore.getState().toolInputCache["textAnalysis"] || "";
  const onInputChange = useCallback((v: string) => useAppStore.getState().setToolInput("textAnalysis", v), []);

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.textAnalysis")} subtitle={t("tools.mining.subtitle")} />
      {!isAiConfigured && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">{t("settings.configureAi")}</p>
        </div>
      )}
      <SentenceMiningTool activePair={activePair} initialWord={cachedInput} onInputChange={onInputChange} />
    </div>
  );
}
