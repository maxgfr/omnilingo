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
} from "lucide-react";
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
  { value: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-haiku-4-5-20251001" },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini" },
  { value: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash" },
  { value: "mistral", label: "Mistral AI", defaultModel: "mistral-small-latest" },
  { value: "glm", label: "GLM (Zhipu)", defaultModel: "glm-4-flash" },
  { value: "claude-cli", label: "Claude CLI (local)", defaultModel: "claude-haiku-4-5-20251001" },
];

const LEVELS = ["A1", "A2", "B1", "B2"];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Settings() {
  const { settings, activePair, languagePairs, switchPair, updateSetting, reloadSettings } = useApp();

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
  const [importing, setImporting] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savingAi, setSavingAi] = useState(false);

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

  // ---- Handlers ----

  const handleSwitchPair = async (pairId: number) => {
    await switchPair(pairId);
    showStatus("Paire de langues changee");
  };

  const handleLevelChange = async (level: string) => {
    await updateSetting("level", level);
    showStatus(`Niveau change : ${level}`);
  };

  const handleWordsPerDayChange = async (value: number) => {
    await updateSetting("words_per_day", String(value));
    showStatus(`Mots par jour : ${value}`);
  };

  const handleToggleDarkMode = async (v: boolean) => {
    await updateSetting("dark_mode", v ? "true" : "false");
  };

  const handleToggleAudio = async (v: boolean) => {
    await updateSetting("audio_enabled", v ? "true" : "false");
    showStatus(v ? "Audio active" : "Audio desactive");
  };

  const handleSaveAi = async () => {
    if (!newProvider) return;
    setSavingAi(true);
    try {
      await bridge.setAiProvider(newProvider, newApiKey, newModel);
      const ai = await bridge.getAiSettings();
      setAiSettings(ai);
      showStatus("Configuration IA sauvegardee");
    } catch (err) {
      showStatus(`Erreur : ${err}`);
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
      showStatus(`Modele ${modelName} telecharge`);
    } catch (err) {
      showStatus(`Erreur telechargement : ${err}`);
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
      showStatus(`Dictionnaire ${dict.source_name}-${dict.target_name} telecharge`);
      await reloadSettings();
    } catch (err) {
      showStatus(`Erreur : ${err}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleImport = async () => {
    if (!activePair) return;
    setImporting(true);
    try {
      const result = await bridge.importBuiltinData(activePair.id);
      showStatus(result);
      // Refresh counts
      const [wc, topics, verbs] = await Promise.all([
        bridge.getWordCount(activePair.id),
        bridge.getGrammarTopics(activePair.id),
        bridge.getVerbs(activePair.id),
      ]);
      setWordCount(wc);
      setGrammarCount(topics.length);
      setVerbCount(verbs.length);
    } catch (err) {
      showStatus(`Erreur import : ${err}`);
    } finally {
      setImporting(false);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      const result = await bridge.clearCache();
      showStatus(result);
    } catch (err) {
      showStatus(`Erreur : ${err}`);
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
      showStatus(`Erreur : ${err}`);
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parametres</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configurez votre experience d'apprentissage
        </p>
      </div>

      {/* ================= 1. LANGUE ================= */}
      <Section icon={Globe} title="Langue" iconColor="text-blue-500 dark:text-blue-400">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Choisissez votre paire de langues active
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
            Aucune paire de langues disponible. Telechargez un dictionnaire ci-dessous.
          </p>
        )}
      </Section>

      {/* ================= 2. APPRENTISSAGE ================= */}
      <Section icon={Brain} title="Apprentissage" iconColor="text-emerald-500 dark:text-emerald-400">
        {/* Level selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Niveau CECRL
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
            Mots par jour : <span className="text-amber-600 dark:text-amber-400 font-bold">{settings?.words_per_day ?? 10}</span>
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
      <Section icon={Zap} title="Intelligence Artificielle" iconColor="text-purple-500 dark:text-purple-400">
        <div className="space-y-4">
          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Fournisseur
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
          {newProvider !== "claude-cli" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Key size={14} />
                  Cle API
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
              Modele
            </label>
            <input
              type="text"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="Nom du modele"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSaveAi}
            disabled={savingAi}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingAi ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Sauvegarder
          </button>

          {/* Current config info */}
          {aiSettings && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
              Configuration actuelle : <span className="font-medium text-gray-700 dark:text-gray-300">{aiSettings.provider}</span> / <span className="font-mono text-gray-700 dark:text-gray-300">{aiSettings.model}</span>
              {aiSettings.api_key ? " — Cle configuree" : " — Aucune cle"}
            </div>
          )}
        </div>
      </Section>

      {/* ================= 4. APPARENCE ================= */}
      <Section icon={Palette} title="Apparence" iconColor="text-pink-500 dark:text-pink-400">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon size={18} className="text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Mode sombre</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Interface en theme sombre</p>
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
                <p className="text-sm font-medium text-gray-900 dark:text-white">Audio</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Prononciation et effets sonores</p>
              </div>
            </div>
            <Toggle
              checked={settings?.audio_enabled ?? true}
              onChange={handleToggleAudio}
            />
          </div>
        </div>
      </Section>

      {/* ================= 5. WHISPER (STT) ================= */}
      <Section icon={Mic} title="Modeles Whisper (STT)" iconColor="text-orange-500 dark:text-orange-400">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Telechargez un modele pour la reconnaissance vocale hors-ligne
        </p>
        {whisperModels.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            Aucun modele disponible
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
                    {model.size_mb} Mo
                  </p>
                </div>
                {model.downloaded ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Check size={14} />
                    Installe
                  </span>
                ) : (
                  <button
                    onClick={() => handleDownloadWhisper(model.name)}
                    disabled={downloadingWhisper !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingWhisper === model.name ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Telechargement...
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        Telecharger
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
      <Section icon={BookOpen} title="Dictionnaires" iconColor="text-blue-500 dark:text-blue-400">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Parcourez et telechargez des dictionnaires depuis FreeDict
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={dictSearch}
            onChange={(e) => setDictSearch(e.target.value)}
            placeholder="Rechercher par langue..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        {filteredDicts.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic text-center py-4">
            {dictSources.length === 0 ? "Aucun dictionnaire disponible" : "Aucun resultat"}
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
                        {dict.word_count ? ` — ${dict.word_count.toLocaleString("fr-FR")} mots` : ""}
                        {dict.size_mb ? ` — ${dict.size_mb} Mo` : ""}
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
                        <span className="hidden sm:inline">Telechargement...</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        <span className="hidden sm:inline">Telecharger</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
            {filteredDicts.length > 50 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
                {filteredDicts.length - 50} dictionnaires supplementaires — affinez votre recherche
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ================= 7. DONNEES ================= */}
      <Section icon={Database} title="Donnees" iconColor="text-gray-500 dark:text-gray-400">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{wordCount.toLocaleString("fr-FR")}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Mots</p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{grammarCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Grammaire</p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{verbCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Verbes</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {/* Import */}
          <button
            onClick={handleImport}
            disabled={importing || !activePair}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? (
              <Loader2 size={18} className="animate-spin text-amber-500" />
            ) : (
              <RefreshCw size={18} className="text-amber-500" />
            )}
            <div className="text-left">
              <p>Importer les donnees integrees</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                Charger les mots, verbes et grammaire pour la paire active
              </p>
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
              <p>Vider le cache</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                Supprimer les fichiers temporaires
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
                <p>Reinitialiser la progression</p>
                <p className="text-xs text-red-500 dark:text-red-400/70 font-normal">
                  Supprimer toutes les donnees d'apprentissage
                </p>
              </div>
            </button>
          ) : (
            <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  Etes-vous sur ?
                </p>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400/80 mb-4">
                Cette action est irreversible. Toute votre progression, vos cartes SRS et vos statistiques seront supprimees.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleResetProgress}
                  disabled={resetting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {resetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Confirmer la reinitialisation
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Annuler
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
