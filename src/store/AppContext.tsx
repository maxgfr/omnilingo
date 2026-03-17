import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import * as bridge from "../lib/bridge";
import type { Settings, LanguagePair } from "../types";

interface AppState {
  settings: Settings | null;
  activePair: LanguagePair | null;
  languagePairs: LanguagePair[];
  loading: boolean;
  reloadSettings: () => Promise<void>;
  switchPair: (pairId: number) => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
  isGerman: () => boolean;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [languagePairs, setLanguagePairs] = useState<LanguagePair[]>([]);
  const [activePair, setActivePair] = useState<LanguagePair | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadSettings = useCallback(async () => {
    try {
      const [s, pairs] = await Promise.all([
        bridge.getSettings(),
        bridge.getLanguagePairs(),
      ]);
      setSettings(s);
      setLanguagePairs(pairs);
      const active = pairs.find((p) => p.id === s.active_language_pair_id) || pairs[0] || null;
      setActivePair(active);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, []);

  const switchPair = useCallback(async (pairId: number) => {
    await bridge.setActiveLanguagePair(pairId);
    await reloadSettings();
  }, [reloadSettings]);

  const updateSettingFn = useCallback(async (key: string, value: string) => {
    await bridge.updateSetting(key, value);
    await reloadSettings();
  }, [reloadSettings]);

  const isGerman = useCallback(() => {
    return activePair?.source_lang === "de";
  }, [activePair]);

  useEffect(() => {
    reloadSettings().then(() => setLoading(false));
  }, [reloadSettings]);

  // Apply dark mode
  useEffect(() => {
    if (settings?.dark_mode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings?.dark_mode]);

  return (
    <AppContext.Provider
      value={{ settings, activePair, languagePairs, loading, reloadSettings, switchPair, updateSetting: updateSettingFn, isGerman }}
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
