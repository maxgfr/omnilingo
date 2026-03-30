import { useState } from "react";
import { Mic, Loader2, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { recordAudio } from "../lib/speech";
import * as bridge from "../lib/bridge";

type MicState = "idle" | "recording" | "transcribing";

interface MicButtonProps {
  expectedText: string;
  language: string;
  onResult?: (transcript: string, isMatch: boolean) => void;
}

export default function MicButton({ expectedText, language, onResult }: MicButtonProps) {
  const { t } = useTranslation();
  const [micState, setMicState] = useState<MicState>("idle");
  const [result, setResult] = useState<{ text: string; match: boolean } | null>(null);

  const handleRecord = async () => {
    if (micState !== "idle") return;

    setResult(null);
    setMicState("recording");

    try {
      const samples = await recordAudio(3000);
      setMicState("transcribing");

      const langCode = language.split("-")[0];
      const transcript = await bridge.transcribeAudio(Array.from(samples), langCode);
      const normalized = transcript.toLowerCase().trim().replace(/[.,!?]/g, "");
      const expected = expectedText.toLowerCase().trim().replace(/[.,!?]/g, "");
      const isMatch = normalized === expected || normalized.includes(expected) || expected.includes(normalized);

      setResult({ text: transcript, match: isMatch });
      onResult?.(transcript, isMatch);
    } catch (err) {
      setResult({ text: String(err), match: false });
    } finally {
      setMicState("idle");
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleRecord}
        disabled={micState !== "idle"}
        className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all ${
          micState === "recording"
            ? "bg-red-500 border-red-500 text-white animate-pulse"
            : micState === "transcribing"
              ? "bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400 cursor-wait"
              : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        }`}
        title={t("mic.record")}
      >
        {micState === "transcribing" ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Mic size={18} />
        )}
      </button>
      {result && (
        <div className={`flex items-center gap-1 text-xs ${result.match ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {result.match ? <Check size={12} /> : <X size={12} />}
          <span className="max-w-[120px] truncate">{result.text}</span>
        </div>
      )}
    </div>
  );
}
