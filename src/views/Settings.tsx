import { useEffect, useState, useCallback } from "react";
import {
  Globe,
  Brain,
  Palette,
  Mic,
  BookOpen,
  Database,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  Check,
  Loader2,
  Search,
  ChevronDown,
  Key,
  Volume2,
  Moon,
  Zap,
  Languages,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { setUILanguage, getUILanguage, getAvailableLanguages, saveCustomTranslation } from "../i18n";
import en from "../i18n/locales/en.json";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";
import type { AiSettings, WhisperModelInfo, DictionarySource } from "../types";

// ---------------------------------------------------------------------------
// Toggle switch component
// ---------------------------------------------------------------------------
function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------
function Section({
  icon: Icon,
  title,
  children,
  iconColor = "text-gray-500 dark:text-gray-400",
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
  iconColor?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700/50">
        <Icon size={20} className={iconColor} />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification toast
// ---------------------------------------------------------------------------
function StatusToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4">
      <Check size={16} />
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider list
// ---------------------------------------------------------------------------
const AI_PROVIDERS = [
  { value: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-haiku-4-5-20251001", models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250514", "claude-opus-4-5-20250514"] },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini", models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "o3-mini", "codex-mini-latest"] },
  { value: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash", models: ["gemini-2.0-flash", "gemini-2.5-pro", "gemini-2.5-flash"] },
  { value: "mistral", label: "Mistral AI", defaultModel: "mistral-small-latest", models: ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest", "codestral-latest"] },
  { value: "glm", label: "GLM (Zhipu)", defaultModel: "glm-4-flash", models: ["glm-4-flash", "glm-4-plus", "glm-4"] },
  { value: "claude-cli", label: "Claude CLI (local)", defaultModel: "claude-sonnet-4-5-20250514", models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250514", "claude-opus-4-5-20250514"], noKey: true },
  { value: "ollama", label: "Ollama (local)", defaultModel: "llama3.2", models: ["llama3.2", "mistral", "gemma2", "phi3"], noKey: true },
];

const AI_PRESETS = [
  { label: "\u26A1 Fast", provider: "anthropic", model: "claude-haiku-4-5-20251001", description: "Quick responses, low cost" },
  { label: "\u2696\uFE0F Balanced", provider: "anthropic", model: "claude-sonnet-4-5-20250514", description: "Good quality, moderate cost" },
  { label: "\uD83E\uDDE0 Best", provider: "anthropic", model: "claude-opus-4-5-20250514", description: "Highest quality, higher cost" },
  { label: "\uD83C\uDD93 Free", provider: "claude-cli", model: "claude-sonnet-4-5-20250514", description: "Local Claude CLI, no API key" },
  { label: "\uD83C\uDFE0 Offline", provider: "ollama", model: "llama3.2", description: "Local Ollama, fully offline" },
];

const LEVELS = ["A1", "A2", "B1", "B2"];

const LANG_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  ru: "Русский",
  ar: "العربية",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Settings() {
  const { t } = useTranslation();
  const { settings, activePair, languagePairs, switchPair, updateSetting, reloadSettings } = useApp();

  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'upToDate' | 'error'>('idle');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [whisperModels, setWhisperModels] = useState<WhisperModelInfo[]>([]);
  const [dictSources, setDictSources] = useState<DictionarySource[]>([]);
  const [dictSearch, setDictSearch] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [grammarCount, setGrammarCount] = useState(0);
  const [verbCount, setVerbCount] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadingWhisper, setDownloadingWhisper] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newProvider, setNewProvider] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [uiLang, setUiLang] = useState(getUILanguage());
  const [translateTarget, setTranslateTarget] = useState("");
  const [translateCode, setTranslateCode] = useState("");
  const [translatingUi, setTranslatingUi] = useState(false);

  // Load all data on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [ai, whisper, dicts] = await Promise.all([
          bridge.getAiSettings().catch(() => null),
          bridge.getWhisperModels().catch(() => []),
          bridge.getAvailableDictionaries().catch(() => []),
        ]);
        if (ai) {
          setAiSettings(ai);
          setNewProvider(ai.provider);
          setNewModel(ai.model);
          setNewApiKey(ai.api_key);
        }
        setWhisperModels(whisper);
        setDictSources(dicts);
      } catch {
        // silently fail
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, []);

  // Load stats when activePair changes
  useEffect(() => {
    if (!activePair) return;
    Promise.all([
      bridge.getWordCount(activePair.id).catch(() => 0),
      bridge.getGrammarTopics(activePair.id).catch(() => []),
      bridge.getVerbs(activePair.id).catch(() => []),
    ]).then(([wc, topics, verbs]) => {
      setWordCount(wc);
      setGrammarCount(topics.length);
      setVerbCount(verbs.length);
    });
  }, [activePair]);

  const showStatus = useCallback((msg: string) => {
    setStatus(msg);
  }, []);

  // ---- Auto-update check on mount ----
  useEffect(() => {
    (async () => {
      try {
        setUpdateStatus('checking');
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (update) {
          setUpdateVersion(update.version);
          setUpdateStatus('available');
        } else {
          setUpdateStatus('upToDate');
        }
      } catch {
        // Silently fall back to idle (e.g. in dev mode where updater is unavailable)
        setUpdateStatus('idle');
      }
    })();
  }, []);

  // ---- Handlers ----

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    setUpdateError(null);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        setUpdateVersion(update.version);
        setUpdateStatus('available');
      } else {
        setUpdateStatus('upToDate');
      }
    } catch (err) {
      setUpdateStatus('error');
      setUpdateError(String(err));
    }
  };

  const handleInstallUpdate = async () => {
    setUpdateStatus('downloading');
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        setUpdateStatus('ready');
        // Auto-relaunch after short delay
        setTimeout(() => relaunch(), 1000);
      }
    } catch (err) {
      setUpdateStatus('error');
      setUpdateError(String(err));
    }
  };

  const handleSwitchPair = async (pairId: number) => {
    await switchPair(pairId);
    showStatus(t("settings.languagePairChanged"));
  };

  const handleLevelChange = async (level: string) => {
    await updateSetting("level", level);
    showStatus(t("settings.levelChanged", { level }));
  };

  const handleWordsPerDayChange = async (value: number) => {
    await updateSetting("words_per_day", String(value));
    showStatus(t("settings.wordsPerDayChanged", { value }));
  };

  const handleToggleDarkMode = async (v: boolean) => {
    await updateSetting("dark_mode", v ? "true" : "false");
  };

  const handleToggleAudio = async (v: boolean) => {
    await updateSetting("audio_enabled", v ? "true" : "false");
    showStatus(v ? t("settings.audioEnabled") : t("settings.audioDisabled"));
  };

  const handleSaveAi = async () => {
    if (!newProvider) return;
    setSavingAi(true);
    try {
      await bridge.setAiProvider(newProvider, newApiKey, newModel);
      const ai = await bridge.getAiSettings();
      setAiSettings(ai);
      showStatus(t("settings.aiConfigSaved"));
    } catch (err) {
      showStatus(`${t("common.error")}: ${err}`);
    } finally {
      setSavingAi(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    setNewProvider(provider);
    const p = AI_PROVIDERS.find((pr) => pr.value === provider);
    if (p) setNewModel(p.defaultModel);
  };

  const handleDownloadWhisper = async (modelName: string) => {
    setDownloadingWhisper(modelName);
    try {
      await bridge.downloadWhisperModel(modelName);
      const models = await bridge.getWhisperModels();
      setWhisperModels(models);
      showStatus(t("settings.modelDownloaded", { name: modelName }));
    } catch (err) {
      showStatus(`${t("settings.downloadError")}: ${err}`);
    } finally {
      setDownloadingWhisper(null);
    }
  };

  const handleDownloadDict = async (dict: DictionarySource) => {
    const key = `${dict.source_lang}-${dict.target_lang}`;
    setDownloading(key);
    try {
      await bridge.downloadDictionary(
        dict.source_lang,
        dict.target_lang,
        dict.url,
        dict.source_name,
        dict.target_name,
      );
      showStatus(t("settings.dictDownloaded", { name: `${dict.source_name}-${dict.target_name}` }));
      await reloadSettings();
    } catch (err) {
      showStatus(`${t("common.error")}: ${err}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      const result = await bridge.clearCache();
      showStatus(result);
    } catch (err) {
      showStatus(`${t("common.error")}: ${err}`);
    } finally {
      setClearingCache(false);
    }
  };

  const handleResetProgress = async () => {
    setResetting(true);
    try {
      const result = await bridge.resetProgress();
      showStatus(result);
      await reloadSettings();
      setShowResetConfirm(false);
    } catch (err) {
      showStatus(`${t("common.error")}: ${err}`);
    } finally {
      setResetting(false);
    }
  };

  // ---- Filter dictionaries ----
  const filteredDicts = dictSources.filter((d) => {
    if (!dictSearch.trim()) return true;
    const q = dictSearch.toLowerCase();
    return (
      d.source_name.toLowerCase().includes(q) ||
      d.target_name.toLowerCase().includes(q) ||
      d.source_lang.toLowerCase().includes(q) ||
      d.target_lang.toLowerCase().includes(q)
    );
  });

  if (loadingData) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("settings.title")}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("settings.subtitle")}
        </p>
      </div>

      {/* ================= 0. MISE A JOUR ================= */}
      <Section icon={RefreshCw} title={t("settings.update")} iconColor="text-cyan-500 dark:text-cyan-400">
        <div className="flex items-center justify-between">
          <div>
            {updateStatus === 'idle' && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{t("settings.checkingUpdate").replace("...", "")}</p>
            )}
            {updateStatus === 'checking' && (
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {t("settings.checkingUpdate")}
              </p>
            )}
            {updateStatus === 'upToDate' && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <Check size={14} />
                {t("settings.upToDate")}
              </p>
            )}
            {updateStatus === 'available' && (
              <div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {t("settings.updateAvailable")}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t("settings.updateDescription", { version: updateVersion })}
                </p>
              </div>
            )}
            {updateStatus === 'downloading' && (
              <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {t("settings.installing")}
              </p>
            )}
            {updateStatus === 'ready' && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {t("settings.restartRequired")}
              </p>
            )}
            {updateStatus === 'error' && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {t("settings.updateError")}: {updateError}
              </p>
            )}
          </div>
          <div>
            {(updateStatus === 'idle' || updateStatus === 'upToDate' || updateStatus === 'error') && (
              <button
                onClick={handleCheckUpdate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <RefreshCw size={14} />
                {t("settings.update")}
              </button>
            )}
            {updateStatus === 'available' && (
              <button
                onClick={handleInstallUpdate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
              >
                <Download size={14} />
                {t("settings.updateNow")}
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* ================= 1. LANGUE ================= */}
      <Section icon={Globe} title={t("settings.language")} iconColor="text-blue-500 dark:text-blue-400">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t("settings.chooseLanguagePair")}
        </p>
        <div className="flex flex-wrap gap-2">
          {languagePairs.map((pair) => (
            <button
              key={pair.id}
              onClick={() => handleSwitchPair(pair.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                activePair?.id === pair.id
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 shadow-sm"
                  : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
              }`}
            >
              <span className="text-lg">{pair.source_flag}</span>
              <span>{pair.source_name}</span>
              <span className="text-gray-400 dark:text-gray-500">→</span>
              <span className="text-lg">{pair.target_flag}</span>
              <span>{pair.target_name}</span>
              {activePair?.id === pair.id && <Check size={16} className="ml-1 text-amber-500" />}
            </button>
          ))}
        </div>
        {languagePairs.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            {t("settings.noLanguagePairs")}
          </p>
        )}
      </Section>

      {/* ================= 2. APPRENTISSAGE ================= */}
      <Section icon={Brain} title={t("settings.learning")} iconColor="text-emerald-500 dark:text-emerald-400">
        {/* Level selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("settings.cefrLevel")}
          </label>
          <div className="flex gap-2">
            {LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => handleLevelChange(level)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                  settings?.level === level
                    ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                    : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-amber-300 dark:hover:border-amber-700"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Words per day */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("settings.wordsPerDay")}: <span className="text-amber-600 dark:text-amber-400 font-bold">{settings?.words_per_day ?? 10}</span>
          </label>
          <input
            type="range"
            min={3}
            max={30}
            step={1}
            value={settings?.words_per_day ?? 10}
            onChange={(e) => handleWordsPerDayChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
            <span>3</span>
            <span>15</span>
            <span>30</span>
          </div>
        </div>
      </Section>

      {/* ================= 3. INTELLIGENCE ARTIFICIELLE ================= */}
      <Section icon={Zap} title={t("settings.ai")} iconColor="text-purple-500 dark:text-purple-400">
        <div className="space-y-4">
          {/* Presets */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {t("settings.presets")}
            </label>
            <div className="flex flex-wrap gap-2">
              {AI_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setNewProvider(preset.provider);
                    setNewModel(preset.model);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all"
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("settings.provider")}
            </label>
            <div className="relative">
              <select
                value={newProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* API Key */}
          {!AI_PROVIDERS.find(p => p.value === newProvider)?.noKey && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Key size={14} />
                  {t("settings.apiKey")}
                </span>
              </label>
              <input
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono"
              />
            </div>
          )}

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("settings.model")}
            </label>
            <div className="relative">
              <select
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono"
              >
                {(AI_PROVIDERS.find(p => p.value === newProvider)?.models || []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Save & Test buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveAi}
              disabled={savingAi}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingAi ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {t("common.save")}
            </button>
            <button
              onClick={async () => {
                showStatus(t("settings.testingConnection"));
                try {
                  const response = await bridge.askAi("Reply with exactly: OK");
                  if (response.includes("OK")) {
                    showStatus(t("settings.connectionSuccess"));
                  } else {
                    showStatus(t("settings.connectionSuccess"));
                  }
                } catch (err) {
                  showStatus(`${t("settings.connectionFailed")}: ${err}`);
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Zap size={16} />
              {t("settings.testConnection")}
            </button>
          </div>

          {/* Current config info */}
          {aiSettings && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
              {t("settings.currentConfig")}: <span className="font-medium text-gray-700 dark:text-gray-300">{aiSettings.provider}</span> / <span className="font-mono text-gray-700 dark:text-gray-300">{aiSettings.model}</span>
              {aiSettings.api_key ? ` — ${t("settings.keyConfigured")}` : ` — ${t("settings.noKey")}`}
            </div>
          )}
        </div>
      </Section>

      {/* ================= 4. APPARENCE ================= */}
      <Section icon={Palette} title={t("settings.appearance")} iconColor="text-pink-500 dark:text-pink-400">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon size={18} className="text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t("settings.darkMode")}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.darkModeDescription")}</p>
              </div>
            </div>
            <Toggle
              checked={settings?.dark_mode ?? false}
              onChange={handleToggleDarkMode}
            />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700/50" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 size={18} className="text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t("settings.audio")}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.audioDescription")}</p>
              </div>
            </div>
            <Toggle
              checked={settings?.audio_enabled ?? true}
              onChange={handleToggleAudio}
            />
          </div>
        </div>
      </Section>

      {/* ================= 4b. UI LANGUAGE ================= */}
      <Section icon={Languages} title={t("settings.uiLanguage")} iconColor="text-indigo-500 dark:text-indigo-400">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t("settings.uiLanguageDescription")}
        </p>

        {/* Language selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {getAvailableLanguages().map((code) => (
            <button
              key={code}
              onClick={() => {
                setUILanguage(code);
                setUiLang(code);
              }}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                uiLang === code
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 shadow-sm"
                  : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
              }`}
            >
              {LANG_NAMES[code] ?? code}
              {uiLang === code && <Check size={16} className="ml-2 inline text-amber-500" />}
            </button>
          ))}
        </div>

        {/* AI Translate */}
        <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t("settings.translateWithAi")}
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              value={translateTarget}
              onChange={(e) => setTranslateTarget(e.target.value)}
              placeholder={t("settings.languageNamePlaceholder")}
              className="flex-1 min-w-[160px] rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <input
              type="text"
              value={translateCode}
              onChange={(e) => setTranslateCode(e.target.value)}
              placeholder={t("settings.codePlaceholder")}
              className="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono"
            />
          </div>
          <button
            onClick={async () => {
              if (!translateTarget.trim() || !translateCode.trim()) return;
              setTranslatingUi(true);
              try {
                const jsonContent = JSON.stringify(en, null, 2);
                const prompt = `Translate the following JSON translation file from English to ${translateTarget}.\nTranslate ONLY the values, keep all keys exactly as-is.\nReturn ONLY valid JSON, no markdown, no explanation.\n${jsonContent}`;
                const response = await bridge.askAi(prompt);
                // Extract JSON from the response (handle possible markdown wrapping)
                let jsonStr = response.trim();
                if (jsonStr.startsWith("```")) {
                  jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
                }
                const parsed = JSON.parse(jsonStr);
                saveCustomTranslation(translateCode.trim().toLowerCase(), parsed);
                const code = translateCode.trim().toLowerCase();
                setUILanguage(code);
                setUiLang(code);
                setTranslateTarget("");
                setTranslateCode("");
                showStatus(t("settings.translationSaved"));
              } catch (err) {
                showStatus(`${t("settings.translationError")}: ${err}`);
              } finally {
                setTranslatingUi(false);
              }
            }}
            disabled={translatingUi || !translateTarget.trim() || !translateCode.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {translatingUi ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("settings.translating")}
              </>
            ) : (
              <>
                <Languages size={16} />
                {t("settings.translateWithAi")}
              </>
            )}
          </button>
        </div>
      </Section>

      {/* ================= 5. WHISPER (STT) ================= */}
      <Section icon={Mic} title={t("settings.whisperModels")} iconColor="text-orange-500 dark:text-orange-400">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t("settings.whisperDescription")}
        </p>
        {whisperModels.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            {t("settings.noModelsAvailable")}
          </p>
        ) : (
          <div className="space-y-2">
            {whisperModels.map((model) => (
              <div
                key={model.name}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {model.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {model.size_mb} {t("settings.mb")}
                  </p>
                </div>
                {model.downloaded ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Check size={14} />
                      {t("common.installed")}
                    </span>
                    <button
                      onClick={async () => {
                        await bridge.deleteWhisperModel(model.name);
                        const models = await bridge.getWhisperModels();
                        setWhisperModels(models);
                        showStatus(t("settings.modelDeleted", { name: model.name }));
                      }}
                      className="p-1 text-gray-400 hover:text-rose-500 transition-colors"
                      title={t("common.delete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDownloadWhisper(model.name)}
                    disabled={downloadingWhisper !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingWhisper === model.name ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {t("common.downloading")}
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        {t("common.download")}
                      </>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ================= 6. DICTIONNAIRES ================= */}
      <Section icon={BookOpen} title={t("settings.dictionaries")} iconColor="text-blue-500 dark:text-blue-400">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t("settings.dictionariesDescription")}
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={dictSearch}
            onChange={(e) => setDictSearch(e.target.value)}
            placeholder={t("settings.searchByLanguage")}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        {filteredDicts.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-4">
            {dictSources.length === 0 ? t("settings.noDictionaries") : t("common.noResults")}
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredDicts.slice(0, 50).map((dict) => {
              const key = `${dict.source_lang}-${dict.target_lang}`;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-lg">
                      <span>{dict.source_flag}</span>
                      <span className="text-xs text-gray-400">→</span>
                      <span>{dict.target_flag}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {dict.source_name} → {dict.target_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {dict.provider}
                        {dict.word_count ? ` — ${dict.word_count.toLocaleString()} ${t("common.words").toLowerCase()}` : ""}
                        {dict.size_mb ? ` — ${dict.size_mb} ${t("settings.mb")}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadDict(dict)}
                    disabled={downloading !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {downloading === key ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span className="hidden sm:inline">{t("common.downloading")}</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        <span className="hidden sm:inline">{t("common.download")}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
            {filteredDicts.length > 50 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
                {t("settings.moreDictionaries", { count: filteredDicts.length - 50 })}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ================= 7. DONNEES ================= */}
      <Section icon={Database} title={t("settings.data")} iconColor="text-gray-500 dark:text-gray-400">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{wordCount.toLocaleString()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("common.words")}</p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{grammarCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("common.grammar")}</p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{verbCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("common.verbs")}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {/* Export progress */}
          <button
            onClick={async () => {
              if (!activePair) return;
              try {
                const data = await bridge.exportProgress(activePair.id);
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `omnilingo-progress-${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                showStatus(t("settings.exportSuccess"));
              } catch (err) {
                showStatus(`${t("common.error")}: ${err}`);
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-900 dark:text-white transition-colors"
          >
            <Download size={18} className="text-blue-500" />
            <div className="text-left">
              <p>{t("settings.exportProgress")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">{t("settings.exportDescription")}</p>
            </div>
          </button>

          {/* Import progress */}
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file || !activePair) return;
                try {
                  const text = await file.text();
                  const data = JSON.parse(text);
                  const result = await bridge.importProgress(activePair.id, data);
                  showStatus(result);
                  await reloadSettings();
                } catch (err) {
                  showStatus(`${t("common.error")}: ${err}`);
                }
              };
              input.click();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-900 dark:text-white transition-colors"
          >
            <Upload size={18} className="text-emerald-500" />
            <div className="text-left">
              <p>{t("settings.importProgress")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">{t("settings.importDescription")}</p>
            </div>
          </button>

          {/* Import dictionary file */}
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".csv,.tsv,.json,.txt,.tab,.df";
              input.onchange = async (ev) => {
                const file = (ev.target as HTMLInputElement).files?.[0];
                if (!file || !activePair) return;
                try {
                  const text = await file.text();
                  const ext = file.name.split(".").pop()?.toLowerCase() || "";
                  let fmt = "tsv";
                  if (ext === "csv") fmt = "csv";
                  else if (ext === "json") fmt = "json";
                  else if (["tsv", "tab", "txt", "df"].includes(ext)) fmt = "tsv";
                  const result = await bridge.importFromFile(activePair.id, text, fmt);
                  showStatus(result);
                  const wc = await bridge.getWordCount(activePair.id);
                  setWordCount(wc);
                } catch (err) {
                  showStatus(`${t("common.error")}: ${err}`);
                }
              };
              input.click();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-sm font-medium text-gray-900 dark:text-white transition-colors"
          >
            <BookOpen size={18} className="text-indigo-500" />
            <div className="text-left">
              <p>{t("settings.importFile")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                {t("settings.importFileDescription")}
              </p>
            </div>
          </button>

          {/* Delete all words */}
          <button
            onClick={async () => {
              if (!activePair) return;
              if (!confirm(t("settings.deleteWordsWarning"))) return;
              try {
                await bridge.clearCache();
                await bridge.resetProgress();
                showStatus(t("settings.wordsDeleted"));
                const wc = await bridge.getWordCount(activePair.id);
                setWordCount(wc);
                await reloadSettings();
              } catch (err) {
                showStatus(`${t("common.error")}: ${err}`);
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-sm font-medium text-orange-700 dark:text-orange-400 transition-colors"
          >
            <Trash2 size={18} />
            <div className="text-left">
              <p>{t("settings.deleteWords")}</p>
              <p className="text-xs text-orange-500 dark:text-orange-400/70 font-normal">{t("settings.deleteWordsDescription")}</p>
            </div>
          </button>

          {/* Delete all Whisper models */}
          {whisperModels.some(m => m.downloaded) && (
            <button
              onClick={async () => {
                for (const m of whisperModels.filter(m => m.downloaded)) {
                  await bridge.deleteWhisperModel(m.name);
                }
                const models = await bridge.getWhisperModels();
                setWhisperModels(models);
                showStatus(t("settings.allModelsDeleted"));
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-900 dark:text-white transition-colors"
            >
              <Trash2 size={18} className="text-orange-500" />
              <div className="text-left">
                <p>{t("settings.deleteAllModels")}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">{t("settings.deleteAllModelsDescription")}</p>
              </div>
            </button>
          )}

          {/* Clear custom translations */}
          <button
            onClick={() => {
              localStorage.removeItem("omnilingo-custom-translations");
              showStatus(t("settings.translationsCleared"));
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-900 dark:text-white transition-colors"
          >
            <Trash2 size={18} className="text-gray-500" />
            <div className="text-left">
              <p>{t("settings.clearTranslations")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">{t("settings.clearTranslationsDescription")}</p>
            </div>
          </button>

          {/* Clear cache */}
          <button
            onClick={handleClearCache}
            disabled={clearingCache}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearingCache ? (
              <Loader2 size={18} className="animate-spin text-gray-500" />
            ) : (
              <Trash2 size={18} className="text-gray-500" />
            )}
            <div className="text-left">
              <p>{t("settings.clearCache")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                {t("settings.clearCacheDescription")}
              </p>
            </div>
          </button>

          {/* Reset progress */}
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-sm font-medium text-red-700 dark:text-red-400 transition-colors"
            >
              <AlertTriangle size={18} />
              <div className="text-left">
                <p>{t("settings.resetProgress")}</p>
                <p className="text-xs text-red-500 dark:text-red-400/70 font-normal">
                  {t("settings.resetDescription")}
                </p>
              </div>
            </button>
          ) : (
            <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {t("settings.areYouSure")}
                </p>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400/80 mb-4">
                {t("settings.resetWarning")}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleResetProgress}
                  disabled={resetting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {resetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {t("settings.confirmReset")}
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Status toast */}
      {status && <StatusToast message={status} onClose={() => setStatus(null)} />}
    </div>
  );
}
