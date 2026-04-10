import { useTranslation } from "react-i18next";
import { Lightbulb, Loader2 } from "lucide-react";

interface ExamplePreviewProps {
  children: React.ReactNode;
  onClick?: () => void;
  /** When true, the preview is greyed out, non-clickable, and shows a spinner. */
  loading?: boolean;
}

export default function ExamplePreview({ children, onClick, loading = false }: ExamplePreviewProps) {
  const { t } = useTranslation();
  const interactive = !!onClick && !loading;

  return (
    <div
      className={`relative mt-6 transition-opacity ${
        interactive ? "cursor-pointer hover:opacity-90" : ""
      } ${loading ? "opacity-50 pointer-events-none select-none" : ""}`}
      onClick={interactive ? onClick : undefined}
      aria-busy={loading || undefined}
    >
      <div className="absolute -top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[11px] font-semibold uppercase tracking-wider">
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
        {t("common.example")}
      </div>
      <div className="rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-800/50 p-4 pt-5">
        {children}
      </div>
    </div>
  );
}
