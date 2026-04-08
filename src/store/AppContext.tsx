import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useAppStore } from "./useAppStore";
import type { Settings, LanguagePair } from "../types";

interface AppState {
  settings: Settings | null;
  languagePairs: LanguagePair[];
  loading: boolean;
  reloadSettings: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const settings = useAppStore((s) => s.settings);
  const languagePairs = useAppStore((s) => s.languagePairs);
  const loading = useAppStore((s) => s.loading);
  const reloadSettings = useAppStore((s) => s.reloadSettings);
  const updateSetting = useAppStore((s) => s.updateSetting);

  // Initialize on mount ONCE — use ref to avoid re-triggering
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    reloadSettings();
  }, [reloadSettings]);

  // Apply theme
  useEffect(() => {
    const theme = settings?.dark_mode || "system";
    const applyDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (applyDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle("dark", e.matches);
      };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [settings?.dark_mode]);

  return (
    <AppContext.Provider
      value={{ settings, languagePairs, loading, reloadSettings, updateSetting }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
