import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

export default function SessionTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
      <Timer size={14} />
      <span>{mins}:{secs.toString().padStart(2, "0")}</span>
    </div>
  );
}
