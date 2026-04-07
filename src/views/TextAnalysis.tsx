import { useTranslation } from "react-i18next";
import { FileSearch } from "lucide-react";
import { useApp } from "../store/AppContext";
import { useFeaturePair } from "../lib/useFeaturePair";
import LanguagePairBar from "../components/LanguagePairBar";
import SentenceMiningTool from "../components/tools/SentenceMiningTool";

export default function TextAnalysis() {
  const { t } = useTranslation();
  const { languagePairs } = useApp();
  const { activePair, switchPair } = useFeaturePair("text-analysis");

  return (
    <div className="space-y-6">
      <LanguagePairBar pairs={languagePairs} activePairId={activePair?.id ?? null} onSwitch={switchPair} />
      <div>
        <div className="flex items-center gap-3 mb-1">
          <FileSearch size={24} className="text-teal-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("nav.textAnalysis")}</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("tools.mining.inputPlaceholder")}</p>
      </div>
      <SentenceMiningTool activePair={activePair} />
    </div>
  );
}
