import { useTranslation } from "react-i18next";
import { SpellCheck } from "lucide-react";
import { useApp } from "../store/AppContext";
import { useFeaturePair } from "../lib/useFeaturePair";
import LanguagePairBar from "../components/LanguagePairBar";
import CorrectorTool from "../components/tools/CorrectorTool";

export default function Corrector() {
  const { t } = useTranslation();
  const { languagePairs } = useApp();
  const { activePair, switchPair } = useFeaturePair("corrector");

  return (
    <div className="space-y-6">
      <LanguagePairBar pairs={languagePairs} activePairId={activePair?.id ?? null} onSwitch={switchPair} />
      <div>
        <div className="flex items-center gap-3 mb-1">
          <SpellCheck size={24} className="text-indigo-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("nav.corrector")}</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("tools.corrector.inputPlaceholder")}</p>
      </div>
      <CorrectorTool activePair={activePair} />
    </div>
  );
}
