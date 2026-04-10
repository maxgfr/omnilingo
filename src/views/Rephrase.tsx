import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { useFeaturePair } from "../lib/useFeaturePair";
import { useAppStore, selectIsAiConfigured } from "../store/useAppStore";
import PageHeader from "../components/ui/PageHeader";
import RephraseTool from "../components/tools/RephraseTool";

export default function Rephrase() {
  const { t } = useTranslation();
  const { activePair } = useFeaturePair("rephrase");
  const isAiConfigured = useAppStore(selectIsAiConfigured);
  const cachedInput = useAppStore.getState().toolInputCache["rephrase"] || "";
  const onInputChange = useCallback((v: string) => useAppStore.getState().setToolInput("rephrase", v), []);

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.rephrase")} subtitle={t("tools.rephrase.subtitle")} />
      {!isAiConfigured && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">{t("settings.configureAi")}</p>
        </div>
      )}
      <RephraseTool activePair={activePair} initialWord={cachedInput} onInputChange={onInputChange} />
    </div>
  );
}
