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
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApp } from "../store/AppContext";
import DictionaryPairSelector from "../components/DictionaryPairSelector";
import * as bridge from "../lib/bridge";
import { isMobile } from "../lib/platform";
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
  // API providers
  { value: "anthropic", label: "Anthropic (Claude API)", defaultModel: "claude-sonnet-4-6", placeholder: "claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-6", group: "api" },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini", placeholder: "gpt-4o-mini, gpt-4o, gpt-4.1, o3-mini", group: "api" },
  { value: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash", placeholder: "gemini-2.0-flash, gemini-2.5-pro", group: "api" },
  { value: "mistral", label: "Mistral AI", defaultModel: "mistral-small-latest", placeholder: "mistral-small-latest, mistral-large-latest, codestral-latest", group: "api" },
  { value: "glm", label: "GLM (Zhipu)", defaultModel: "glm-4-flash", placeholder: "glm-4-flash, glm-4-plus, codegeex-4", group: "api" },
  // Local CLI tools (no API key)
  { value: "claude-code", label: "Claude Code (local CLI)", defaultModel: "claude-sonnet-4-6", placeholder: "claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-6", noKey: true, group: "local" },
  { value: "codex", label: "Codex CLI (OpenAI)", defaultModel: "codex-mini-latest", placeholder: "codex-mini-latest", noKey: true, group: "local" },
  { value: "ollama", label: "Ollama (local LLM)", defaultModel: "llama3.2", placeholder: "llama3.2, mistral, gemma2, phi3, qwen2.5", noKey: true, group: "local" },
];

const AI_PRESETS = [
  { label: "\u26A1 Fast", provider: "anthropic", model: "claude-haiku-4-5", description: "Quick, low cost" },
  { label: "\u2696\uFE0F Balanced", provider: "anthropic", model: "claude-sonnet-4-6", description: "Good quality" },
  { label: "\uD83E\uDDE0 Best", provider: "anthropic", model: "claude-opus-4-6", description: "Highest quality" },
  { label: "\uD83D\uDCBB Claude Code", provider: "claude-code", model: "claude-sonnet-4-6", description: "Local CLI, no key" },
  { label: "\uD83D\uDE80 Codex", provider: "codex", model: "codex-mini-latest", description: "OpenAI Codex CLI" },
  { label: "\uD83C\uDFE0 Offline", provider: "ollama", model: "llama3.2", description: "Local Ollama" },
];


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Settings() {
  const { t } = useTranslation();
  const { settings, languagePairs, updateSetting, reloadSettings } = useApp();
  const mobile = isMobile();

  // Filter out local providers on mobile (CLI/Ollama not available)
  const availableProviders = mobile ? AI_PROVIDERS.filter(p => p.group === "api") : AI_PROVIDERS;
  const availablePresets = mobile ? AI_PRESETS.filter(p => !["claude-code", "codex", "ollama"].includes(p.provider)) : AI_PRESETS;

  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'upToDate' | 'error'>('idle');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [newModel, setNewModel] = useState("claude-sonnet-4-6");
  const [newProvider, setNewProvider] = useState("claude-code");
  const [status, setStatus] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; models: string[] }>({ available: false, models: [] });
  const [modelCatalog, setModelCatalog] = useState<Record<string, string[]>>({});
  const [localTheme, setLocalTheme] = useState<string | null>(null);

  // Load all data on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [ai, ollama] = await Promise.all([
          bridge.getAiSettings().catch(() => null),
          bridge.detectOllama().catch(() => ({ available: false, models: [] })),
        ]);
        if (ai) {
          setAiSettings(ai);
          // On mobile, if the stored provider is local-only, default to Anthropic API
          const isLocalProvider = ["claude-code", "claude-cli", "codex", "ollama"].includes(ai.provider);
          if (mobile && isLocalProvider) {
            setNewProvider("anthropic");
            setNewModel("claude-sonnet-4-6");
          } else {
            setNewProvider(ai.provider);
            setNewModel(ai.model);
          }
          setNewApiKey(ai.api_key);
        }
        setOllamaStatus(ollama);
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

  const showStatus = useCallback((msg: string) => {
    setStatus(msg);
  }, []);

  // ---- Auto-update check on mount (desktop only) ----
  useEffect(() => {
    if (mobile) return;
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
  }, [mobile]);

  // ---- Handlers ----

  const handleCheckUpdate = async () => {
    if (mobile) return;
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
    if (mobile) return;
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
    const p = availableProviders.find((pr) => pr.value === provider);
    if (p) setNewModel(p.defaultModel);
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

  const handleDeleteAllData = async () => {
    setDeletingAll(true);
    try {
      const result = await bridge.deleteAllData();
      // Clear per-feature localStorage
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("omnilingo-pair-") || key.startsWith("omnilingo-favs-")) {
          localStorage.removeItem(key);
        }
      }
      showStatus(result);
      await reloadSettings();
      setShowDeleteAllConfirm(false);
    } catch (err) {
      showStatus(`${t("common.error")}: ${err}`);
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

      {/* ================= 0. MISE A JOUR (desktop only) ================= */}
      {!mobile && <Section icon={RefreshCw} title={t("settings.update")} iconColor="text-cyan-500 dark:text-cyan-400">
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
      </Section>}

      {/* ================= 1. DICTIONARIES ================= */}
      <Section icon={BookOpen} title={t("settings.language")} iconColor="text-blue-500 dark:text-blue-400">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t("settings.chooseLanguagePair")}
        </p>
        <DictionaryPairSelector
          pairs={languagePairs}
          onDictionaryDownloaded={reloadSettings}
        />
      </Section>

      {/* ================= 2. INTELLIGENCE ARTIFICIELLE ================= */}
      <Section icon={Zap} title={t("settings.ai")} iconColor="text-purple-500 dark:text-purple-400">
        <div className="space-y-4">
          {/* Presets */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {t("settings.presets")}
            </label>
            <div className="flex flex-wrap gap-2">
              {availablePresets.map((preset) => (
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

          {/* Ollama status (desktop only) */}
          {!mobile && <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
            ollamaStatus.available
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
              : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
          }`}>
            <span className={`w-2 h-2 rounded-full ${ollamaStatus.available ? "bg-emerald-500" : "bg-gray-400"}`} />
            {ollamaStatus.available
              ? `Ollama: ${ollamaStatus.models.length} model${ollamaStatus.models.length !== 1 ? "s" : ""} (${ollamaStatus.models.slice(0, 3).join(", ")}${ollamaStatus.models.length > 3 ? "..." : ""})`
              : "Ollama: not detected"
            }
          </div>}

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
                <optgroup label="API (requires key)">
                  {availableProviders.filter(p => p.group === "api").map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </optgroup>
                {!mobile && <optgroup label="Local (no key needed)">
                  {availableProviders.filter(p => p.group === "local").map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </optgroup>}
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
              {catalogModels.length > 0 && (
                <span className="ml-2 text-xs text-gray-400 font-normal">({catalogModels.length} models available)</span>
              )}
            </label>
            <input
              type="text"
              list="model-suggestions"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder={availableProviders.find(p => p.value === newProvider)?.placeholder || "model-name"}
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
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAllData}
                  disabled={deletingAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {deletingAll ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {t("settings.confirmDeleteAll")}
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
      {status && <StatusToast message={status} onClose={() => setStatus(null)} />}
    </div>
  );
}
