import { useTranslation } from "react-i18next";
import { Lightbulb } from "lucide-react";

interface ExamplePreviewProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export default function ExamplePreview({ children, onClick }: ExamplePreviewProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`relative mt-6 ${onClick ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
      onClick={onClick}
    >
      <div className="absolute -top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[11px] font-semibold uppercase tracking-wider">
        <Lightbulb size={12} />
        {t("common.example", "Example")}
      </div>
      <div className="rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-800/50 p-4 pt-5">
        {children}
      </div>
    </div>
  );
}
