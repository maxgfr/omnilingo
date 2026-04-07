import { useTranslation } from "react-i18next";
import { ArrowRightLeft } from "lucide-react";
import { useApp } from "../store/AppContext";
import { useFeaturePair } from "../lib/useFeaturePair";
import LanguagePairBar from "../components/LanguagePairBar";
import SynonymsTool from "../components/tools/SynonymsTool";

export default function Synonyms() {
  const { t } = useTranslation();
  const { languagePairs } = useApp();
  const { activePair, switchPair } = useFeaturePair("synonyms");

  return (
    <div className="space-y-6">
      <LanguagePairBar pairs={languagePairs} activePairId={activePair?.id ?? null} onSwitch={switchPair} />
      <div>
        <div className="flex items-center gap-3 mb-1">
          <ArrowRightLeft size={24} className="text-indigo-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("nav.synonyms")}</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("tools.synonyms.inputPlaceholder")}</p>
      </div>
      <SynonymsTool activePair={activePair} />
    </div>
  );
}
