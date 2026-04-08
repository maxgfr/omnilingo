import { Loader2 } from "lucide-react";

interface SpinnerProps {
  size?: number;
  className?: string;
  fullPage?: boolean;
}

export default function Spinner({ size = 20, className = "", fullPage }: SpinnerProps) {
  const spinner = <Loader2 size={size} className={`animate-spin text-amber-500 ${className}`} />;
  if (fullPage) {
    return <div className="flex justify-center py-20">{spinner}</div>;
  }
  return spinner;
}
