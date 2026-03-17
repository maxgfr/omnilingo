interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  height?: string;
  label?: string;
  showPercent?: boolean;
}

export default function ProgressBar({ value, max, color = "bg-amber-500", height = "h-2", label, showPercent = false }: ProgressBarProps) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div>
      {(label || showPercent) && (
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          {label && <span>{label}</span>}
          {showPercent && <span>{percent}%</span>}
        </div>
      )}
      <div className={`${height} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${color}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface CEFRBarProps {
  level: string;
}

export function CEFRBar({ level }: CEFRBarProps) {
  const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const currentIndex = levels.indexOf(level);

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        {levels.map((l, i) => (
          <span key={l} className={i <= currentIndex ? "font-bold text-amber-600 dark:text-amber-400" : ""}>
            {l}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        {levels.map((l, i) => (
          <div
            key={l}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i <= currentIndex
                ? i === currentIndex
                  ? "bg-amber-500"
                  : "bg-amber-300 dark:bg-amber-600"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
