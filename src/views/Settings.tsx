import { useEffect, useState, useCallback } from "react";
import {
  Palette,
  Database,
  Trash2,
  Download,
  RefreshCw,
  AlertTriangle,
  Check,
  Loader2,
  ChevronDown,
  Moon,
  Zap,
  BookOpen,
  Eye,
  EyeOff,
  XCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../store/AppContext";
import { useAppStore } from "../store/useAppStore";
import DictionaryPairSelector from "../components/DictionaryPairSelector";
import * as bridge from "../lib/bridge";
import type { AiSettings } from "../types";

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
function StatusToast({ message, variant = "success", onClose }: { message: string; variant?: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const isError = variant === "error";
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 ${isError ? "bg-red-600" : "bg-emerald-600"} text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-4`}>
      {isError ? <XCircle size={16} /> : <Check size={16} />}
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider list
// Brand names are kept verbatim (they're proper nouns); the descriptive
// suffix in parentheses is composed at render time from i18n keys.
// ---------------------------------------------------------------------------
type ProviderLabelKey = "anthropic" | "openai" | "gemini" | "mistral" | "glm" | "custom" | "claude-code" | "codex" | "ollama" | "lmstudio";

const AI_PROVIDERS: Array<{
  value: string;
  brand: string;
  labelKey: ProviderLabelKey;
  defaultModel: string;
  placeholder: string;
  noKey?: boolean;
  group: "api" | "local";
}> = [
  // API providers
  { value: "anthropic", brand: "Anthropic", labelKey: "anthropic", defaultModel: "claude-sonnet-4-6", placeholder: "claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-6", group: "api" },
  { value: "openai", brand: "OpenAI", labelKey: "openai", defaultModel: "gpt-4o-mini", placeholder: "gpt-4o-mini, gpt-4o, gpt-4.1, o3-mini", group: "api" },
  { value: "gemini", brand: "Google Gemini", labelKey: "gemini", defaultModel: "gemini-2.0-flash", placeholder: "gemini-2.0-flash, gemini-2.5-pro", group: "api" },
  { value: "mistral", brand: "Mistral AI", labelKey: "mistral", defaultModel: "mistral-small-latest", placeholder: "mistral-small-latest, mistral-large-latest, codestral-latest", group: "api" },
  { value: "glm", brand: "GLM", labelKey: "glm", defaultModel: "glm-4.7-flash", placeholder: "glm-4.7-flash, glm-4.7, glm-5, glm-4.5-flash", group: "api" },
  { value: "custom", brand: "Custom", labelKey: "custom", defaultModel: "", placeholder: "your-model-name", group: "api" },
  // Local CLI tools (no API key)
  { value: "claude-code", brand: "Claude Code", labelKey: "claude-code", defaultModel: "claude-sonnet-4-6", placeholder: "claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-6", noKey: true, group: "local" },
  { value: "codex", brand: "Codex CLI", labelKey: "codex", defaultModel: "codex-mini-latest", placeholder: "codex-mini-latest", noKey: true, group: "local" },
  { value: "ollama", brand: "Ollama", labelKey: "ollama", defaultModel: "", placeholder: "llama3.2, mistral, gemma3, qwen3, deepseek-r1", noKey: true, group: "local" },
  { value: "lmstudio", brand: "LM Studio", labelKey: "lmstudio", defaultModel: "", placeholder: "", noKey: true, group: "local" },
];


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Settings() {
  const { t } = useTranslation();
  const { settings, languagePairs, updateSetting, reloadSettings } = useApp();

  const availableProviders = AI_PROVIDERS;

  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'upToDate' | 'error'>('idle');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);

  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [newModel, setNewModel] = useState("claude-sonnet-4-6");
  const [newProvider, setNewProvider] = useState("claude-code");
  const [newCustomUrl, setNewCustomUrl] = useState("");
  const storeSetAiConfig = useAppStore((s) => s.setAiConfig);
  const [status, setStatus] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [deletingAll, setDeletingAll] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [testTimer, setTestTimer] = useState(0);
  const [testing, setTesting] = useState(false);
  const [modelCatalog, setModelCatalog] = useState<Record<string, string[]>>({});
  const [localTheme, setLocalTheme] = useState<string | null>(null);

  // Load all data on mount
  useEffect(() => {
    const load = async () => {
      try {
        const ai = await bridge.getAiSettings().catch(() => null);
        if (ai) {
          setAiSettings(ai);
          setNewProvider(ai.provider);
          setNewModel(ai.model);
          setNewApiKey(ai.api_key);
        }
        // Load model catalog from models.dev
        bridge.fetchModelCatalog().then(setModelCatalog).catch(() => {});
      } catch {
        // silently fail
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, []);

  const showStatus = useCallback((msg: string, variant: "success" | "error" = "success") => {
    setStatus({ message: msg, variant });
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

  // ---- Read the bundled app version once on mount ----
  useEffect(() => {
    (async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        setAppVersion(await getVersion());
      } catch {
        // Non-Tauri context (e.g. vitest) — leave version null.
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

  const handleSetTheme = async (theme: string) => {
    // Apply immediately for instant feedback
    const applyDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", applyDark);
    setLocalTheme(theme);
    try {
      await updateSetting("dark_mode", theme);
    } finally {
      setLocalTheme(null);
    }
  };

  const handleSaveAi = async () => {
    if (!newProvider) return;
    setSavingAi(true);
    try {
      await storeSetAiConfig(newProvider, newApiKey, newModel, newCustomUrl);
      if (newProvider === "custom") {
        await bridge.setAiCustomUrl(newCustomUrl);
      }
      const ai = await bridge.getAiSettings();
      setAiSettings(ai);
      showStatus(t("settings.aiConfigSaved"));
    } catch (err) {
      showStatus(`${t("common.error")}: ${err}`, "error");
    } finally {
      setSavingAi(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    setNewProvider(provider);
    const p = availableProviders.find((pr) => pr.value === provider);
    if (p) setNewModel(p.defaultModel);
  };

  const handleDeleteAllData = async () => {
    setDeletingAll(true);
    try {
      const result = await bridge.deleteAllData();
      // Clear per-feature localStorage
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("omnilingo-")) {
          localStorage.removeItem(key);
        }
      }
      // Reset all Zustand state (decks, caches, etc.)
      useAppStore.getState().resetAllState();
      showStatus(result);
      await reloadSettings();
      setShowDeleteAllConfirm(false);
    } catch (err) {
      showStatus(`${t("common.error")}: ${err}`, "error");
    } finally {
      setDeletingAll(false);
    }
  };

  // Map provider to catalog key
  const providerToCatalog: Record<string, string> = {
    anthropic: "anthropic",
    openai: "openai",
    gemini: "google-ai-studio",
    mistral: "mistral",
  };
  const catalogKey = providerToCatalog[newProvider];
  const catalogModels = catalogKey ? (modelCatalog[catalogKey] || []) : [];

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
        <div className="mb-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{t("settings.currentVersion")}</span>
          <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
            {appVersion ? `v${appVersion}` : "—"}
          </span>
        </div>
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

      {/* ================= 1. DICTIONARIES ================= */}
      <Section icon={BookOpen} title={t("settings.language")} iconColor="text-blue-500 dark:text-blue-400">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t("settings.chooseLanguagePair")}
        </p>
        <DictionaryPairSelector
          pairs={languagePairs}
          onChange={reloadSettings}
        />
      </Section>

      {/* ================= 2. INTELLIGENCE ARTIFICIELLE ================= */}
      <Section icon={Zap} title={t("settings.ai")} iconColor="text-purple-500 dark:text-purple-400">
        <div className="space-y-4">
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
                <optgroup label={t("settings.providersApi")}>
                  {availableProviders.filter(p => p.group === "api").map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.brand} ({t(`settings.providerSuffix.${p.labelKey}`)})
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("settings.providersLocal")}>
                  {availableProviders.filter(p => p.group === "local").map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.brand} ({t(`settings.providerSuffix.${p.labelKey}`)})
                    </option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* API Key */}
          {!availableProviders.find(p => p.value === newProvider)?.noKey && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("settings.apiKey")}
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder=""
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Custom provider URL */}
          {newProvider === "custom" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("settings.endpointUrl")}
              </label>
              <input
                type="url"
                value={newCustomUrl}
                onChange={(e) => setNewCustomUrl(e.target.value)}
                placeholder="https://api.example.com/v1/chat/completions"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono"
              />
            </div>
          )}

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("settings.model")}
              {catalogModels.length > 0 && (
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  ({t("settings.modelsAvailable", { count: catalogModels.length })})
                </span>
              )}
            </label>
            <input
              type="text"
              list="model-suggestions"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder={availableProviders.find(p => p.value === newProvider)?.placeholder || t("settings.modelNamePlaceholder")}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono"
            />
            <datalist id="model-suggestions">
              {catalogModels.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
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
                setTesting(true);
                setTestTimer(0);
                const timerInterval = setInterval(() => {
                  setTestTimer((prev) => prev + 1);
                }, 1000);
                try {
                  const response = await bridge.testAiConnection(
                    newProvider,
                    newApiKey,
                    newModel,
                    newProvider === "custom" ? newCustomUrl : undefined,
                  );
                  if (response.includes("OK")) {
                    showStatus(t("settings.connectionSuccess"));
                  } else {
                    showStatus(`${t("settings.connectionFailed")}: unexpected response`, "error");
                  }
                } catch (err) {
                  showStatus(`${t("settings.connectionFailed")}: ${err}`, "error");
                } finally {
                  clearInterval(timerInterval);
                  setTesting(false);
                  setTestTimer(0);
                }
              }}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {testing ? `${t("settings.testConnection")} (${testTimer}s)` : t("settings.testConnection")}
            </button>
          </div>

          {/* Timeout warning for AI test */}
          {testing && testTimer >= 10 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={14} className="flex-shrink-0" />
              {t("settings.testTakingLong")}
            </div>
          )}

          {/* Current config info */}
          {aiSettings && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
              {t("settings.currentConfig")}: <span className="font-medium text-gray-700 dark:text-gray-300">{aiSettings.provider}</span> / <span className="font-mono text-gray-700 dark:text-gray-300">{aiSettings.model}</span>
              {aiSettings.api_key ? ` \u2014 ${t("settings.keyConfigured")}` : ` \u2014 ${t("settings.noKey")}`}
            </div>
          )}
        </div>
      </Section>

      {/* ================= 3. APPARENCE ================= */}
      <Section icon={Palette} title={t("settings.appearance")} iconColor="text-pink-500 dark:text-pink-400">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Moon size={18} className="text-gray-500 dark:text-gray-400" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">{t("settings.darkMode")}</p>
          </div>
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {[
              { value: "light", label: t("settings.themeLight") },
              { value: "system", label: t("settings.themeSystem") },
              { value: "dark", label: t("settings.themeDark") },
            ].map((opt) => {
              const current = localTheme ?? settings?.dark_mode ?? "system";
              return (
                <button key={opt.value} onClick={() => handleSetTheme(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    current === opt.value ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}>{opt.label}</button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ================= 4. DONNEES ================= */}
      <Section icon={Database} title={t("settings.data")} iconColor="text-gray-500 dark:text-gray-400">
        <div className="space-y-3">
          {/* Delete all data */}
          {!showDeleteAllConfirm ? (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-red-300 dark:border-red-700 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-sm font-bold text-red-700 dark:text-red-400 transition-colors"
            >
              <Trash2 size={18} />
              <div className="text-left">
                <p>{t("settings.deleteAll")}</p>
                <p className="text-xs text-red-500 dark:text-red-400/70 font-normal">
                  {t("settings.deleteAllDescription")}
                </p>
              </div>
            </button>
          ) : (
            <div className="rounded-lg border-2 border-red-400 dark:border-red-600 bg-red-100 dark:bg-red-900/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {t("settings.areYouSure")}
                </p>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400/80 mb-4">
                {t("settings.deleteAllWarning")}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDeleteAllData}
                  disabled={deletingAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {deletingAll ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {t("settings.deleteAll")}
                </button>
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
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
      {status && <StatusToast message={status.message} variant={status.variant} onClose={() => setStatus(null)} />}
    </div>
  );
}
