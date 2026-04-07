import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { useApp } from "../store/AppContext";
import { useFeaturePair } from "../lib/useFeaturePair";
import LanguagePairBar from "../components/LanguagePairBar";
import RephraseTool from "../components/tools/RephraseTool";

export default function Rephrase() {
  const { t } = useTranslation();
  const { languagePairs } = useApp();
  const { activePair, switchPair } = useFeaturePair("rephrase");

  return (
    <div className="space-y-6">
      <LanguagePairBar pairs={languagePairs} activePairId={activePair?.id ?? null} onSwitch={switchPair} />
      <div>
        <div className="flex items-center gap-3 mb-1">
          <RefreshCw size={24} className="text-indigo-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("nav.rephrase")}</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("tools.rephrase.inputPlaceholder")}</p>
      </div>
      <RephraseTool activePair={activePair} />
    </div>
  );
}
