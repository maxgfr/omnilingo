import { useState, useCallback, useRef } from "react";

/**
 * Progressive display hook for AI responses.
 * Shows text character by character for a streaming-like UX effect.
 * Uses the existing askAi() under the hood (no backend changes needed).
 */
export function useStreamingResponse() {
  const [displayedText, setDisplayedText] = useState("");
  const [fullText, setFullText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsStreaming(false);
    // Show full text immediately when stopped
    setDisplayedText((prev) => prev || fullText);
  }, [fullText]);

  const streamResponse = useCallback(
    async (fetchFn: () => Promise<string>) => {
      // Clear previous
      setDisplayedText("");
      setFullText("");
      setIsLoading(true);
      setIsStreaming(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      try {
        const response = await fetchFn();
        setFullText(response);
        setIsLoading(false);
        setIsStreaming(true);

        // Progressive reveal: much faster for longer texts
        const chars = [...response];
        const charsPerTick = Math.max(3, Math.ceil(chars.length / 40)); // ~0.7 seconds total
        let idx = 0;

        return new Promise<string>((resolve) => {
          intervalRef.current = window.setInterval(() => {
            idx += charsPerTick;
            if (idx >= chars.length) {
              setDisplayedText(response);
              setIsStreaming(false);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              resolve(response);
            } else {
              setDisplayedText(chars.slice(0, idx).join(""));
            }
          }, 16); // ~60fps
        });
      } catch (err) {
        setIsLoading(false);
        setIsStreaming(false);
        throw err;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDisplayedText("");
    setFullText("");
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  return {
    displayedText,
    fullText,
    isStreaming,
    isLoading,
    streamResponse,
    stop,
    reset,
  };
}
