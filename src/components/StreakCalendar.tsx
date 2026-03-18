interface StreakCalendarProps {
  data: Record<string, number>; // date -> activity count
}

export default function StreakCalendar({ data }: StreakCalendarProps) {
  // Generate 365 days of data
  const today = new Date();
  const days: { date: string; count: number }[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    days.push({ date: key, count: data[key] || 0 });
  }

  const maxCount = Math.max(...days.map(d => d.count), 1);
  const weeks: typeof days[] = [];
  // Group into weeks (columns)
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  function getColor(count: number): string {
    if (count === 0) return "bg-gray-100 dark:bg-gray-800";
    const intensity = count / maxCount;
    if (intensity < 0.25) return "bg-emerald-200 dark:bg-emerald-900";
    if (intensity < 0.5) return "bg-emerald-300 dark:bg-emerald-700";
    if (intensity < 0.75) return "bg-emerald-400 dark:bg-emerald-600";
    return "bg-emerald-500 dark:bg-emerald-500";
  }

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px] min-w-[700px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <div
                key={day.date}
                className={`w-[11px] h-[11px] rounded-sm ${getColor(day.count)}`}
                title={`${day.date}: ${day.count} activities`}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Month labels */}
      <div className="flex mt-1 min-w-[700px]">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="text-[10px] text-gray-400 flex-1">{months[(today.getMonth() - 11 + i + 12) % 12]}</span>
        ))}
      </div>
    </div>
  );
}
