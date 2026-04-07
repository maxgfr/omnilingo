import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import * as bridge from "../lib/bridge";
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
  const [settings, setSettings] = useState<Settings | null>(null);
  const [languagePairs, setLanguagePairs] = useState<LanguagePair[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadSettings = useCallback(async () => {
    try {
      const [s, pairs] = await Promise.all([
        bridge.getSettings(),
        bridge.getLanguagePairs(),
      ]);
      setSettings(s);
      setLanguagePairs(pairs);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, []);

  const updateSettingFn = useCallback(async (key: string, value: string) => {
    await bridge.updateSetting(key, value);
    await reloadSettings();
  }, [reloadSettings]);

  useEffect(() => {
    reloadSettings().then(() => setLoading(false));
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
      value={{ settings, languagePairs, loading, reloadSettings, updateSetting: updateSettingFn }}
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
