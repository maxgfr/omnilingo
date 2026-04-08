import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { useFeaturePair } from "../lib/useFeaturePair";
import { useAppStore, selectIsAiConfigured } from "../store/useAppStore";
import PageHeader from "../components/ui/PageHeader";
import CorrectorTool from "../components/tools/CorrectorTool";

export default function Corrector() {
  const { t } = useTranslation();
  const { activePair } = useFeaturePair("corrector");
  const isAiConfigured = useAppStore(selectIsAiConfigured);
  const cachedInput = useAppStore.getState().toolInputCache["corrector"] || "";
  const onInputChange = useCallback((v: string) => useAppStore.getState().setToolInput("corrector", v), []);

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.corrector")} subtitle={t("tools.corrector.subtitle")} />
      {!isAiConfigured && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">{t("settings.configureAi", "Configurez un fournisseur IA dans les Paramètres pour utiliser cette fonctionnalité.")}</p>
        </div>
      )}
      <CorrectorTool activePair={activePair} initialWord={cachedInput} onInputChange={onInputChange} />
    </div>
  );
}
