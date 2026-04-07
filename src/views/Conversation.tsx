import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Send,
  Loader2,
  RotateCcw,
  Star,
  ArrowLeft,
  Plus,
  Trash2,
  Clock,
  PenLine,
  BookOpen,
  MessagesSquare,
  Dumbbell,
  Languages,
  X,
  Eye,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { useFeaturePair } from "../lib/useFeaturePair";
import LanguagePairBar from "../components/LanguagePairBar";
import * as bridge from "../lib/bridge";
import { formatMessage } from "../lib/markdown";
import { useStreamingResponse } from "../lib/useStreamingResponse";
import type { ConversationScenario, ConversationSession } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Evaluation {
  fluency: number;
  grammar: number;
  vocabulary: number;
  corrections: string[];
  summary: string;
}

type PresetMode = "correct" | "grammar" | "free" | "exercises" | "translate";

type Screen = "home" | "chat" | "evaluation";

const EXCHANGE_LIMIT = 8;

// ---------------------------------------------------------------------------
// Preset mode definitions
// ---------------------------------------------------------------------------

interface PresetDef {
  mode: PresetMode;
  icon: typeof PenLine;
  labelKey: string;
  buildSystemPrompt: (sourceName: string, targetName: string) => string;
}

const PRESET_DEFS: PresetDef[] = [
  {
    mode: "correct",
    icon: PenLine,
    labelKey: "chat.correctSentence",
    buildSystemPrompt: (src, tgt) =>
      `You are a language correction assistant for ${src}. The student writes sentences and you correct them, explaining errors in ${tgt}.`,
  },
  {
    mode: "grammar",
    icon: BookOpen,
    labelKey: "chat.explainGrammar",
    buildSystemPrompt: (src, tgt) =>
      `You are a ${src} grammar teacher. Explain grammar rules and answer questions in ${tgt}.`,
  },
  {
    mode: "free",
    icon: MessagesSquare,
    labelKey: "chat.freeConversation",
    buildSystemPrompt: (src) =>
      `You are a conversation partner. Speak in ${src}. Correct mistakes gently.`,
  },
  {
    mode: "exercises",
    icon: Dumbbell,
    labelKey: "chat.exercises",
    buildSystemPrompt: (src, tgt) =>
      `You are a language exercise generator for ${src} learners. Generate fill-in-blank, translation, and grammar exercises. Explain in ${tgt}.`,
  },
  {
    mode: "translate",
    icon: Languages,
    labelKey: "chat.translate",
    buildSystemPrompt: (src, tgt) =>
      `You are a translator between ${src} and ${tgt}. Translate text and explain nuances.`,
  },
];

// ---------------------------------------------------------------------------
// Built-in scenario templates
// ---------------------------------------------------------------------------

function useBuiltinScenarios() {
  const { t } = useTranslation();
  return useMemo(
    () => [
      {
        id: "restaurant",
        icon: "\uD83C\uDF7D\uFE0F",
        title: t("conversation.restaurant"),
        description: t("conversation.restaurantDesc"),
        role: "waiter",
      },
      {
        id: "office",
        icon: "\uD83D\uDCBC",
        title: t("conversation.office"),
        description: t("conversation.officeDesc"),
        role: "colleague",
      },
      {
        id: "doctor",
        icon: "\uD83C\uDFE5",
        title: t("conversation.doctor"),
        description: t("conversation.doctorDesc"),
        role: "doctor",
      },
      {
        id: "shopping",
        icon: "\uD83D\uDED2",
        title: t("conversation.shopping"),
        description: t("conversation.shoppingDesc"),
        role: "vendor",
      },
      {
        id: "travel",
        icon: "\u2708\uFE0F",
        title: t("conversation.travel"),
        description: t("conversation.travelDesc"),
        role: "tourist information agent",
      },
    ],
    [t],
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Conversation() {
  const { t } = useTranslation();
  const { languagePairs } = useApp();
  const { activePair, switchPair } = useFeaturePair("conversation");

  const builtinScenarios = useBuiltinScenarios();

  // ---- Screen state ----
  const [screen, setScreen] = useState<Screen>("home");

  // ---- Home data ----
  const [customScenarios, setCustomScenarios] = useState<ConversationScenario[]>([]);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [showNewScenarioForm, setShowNewScenarioForm] = useState(false);
  const [newScenario, setNewScenario] = useState({ name: "", icon: "\uD83D\uDCAC", description: "", systemPrompt: "" });

  // ---- Chat state ----
  const [chatMode, setChatMode] = useState<PresetMode | "scenario" | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");

  // ---- Scenario-specific state ----
  const [selectedBuiltinId, setSelectedBuiltinId] = useState<string | null>(null);
  const [selectedCustomScenario, setSelectedCustomScenario] = useState<ConversationScenario | null>(null);
  const [userExchanges, setUserExchanges] = useState(0);

  // ---- Evaluation state ----
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  // ---- View-only replay ----
  const [viewingSession, setViewingSession] = useState<ConversationSession | null>(null);

  // ---- Streaming ----
  const { displayedText, isStreaming, isLoading: streamLoading, streamResponse, stop: stopStream } = useStreamingResponse();

  // ---- Refs ----
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pairId = activePair?.id ?? 0;
  const sourceName = activePair?.source_name || "the target language";
  const targetName = activePair?.target_name || "the native language";
  const level = "A2";

  // ---- Load home data ----
  const loadHomeData = useCallback(async () => {
    if (!pairId) return;
    try {
      const [scenarios, sessionsData] = await Promise.all([
        bridge.getConversationScenarios(pairId),
        bridge.getConversationSessions(pairId, 20),
      ]);
      setCustomScenarios(scenarios);
      setSessions(sessionsData);
    } catch (err) {
      console.error("Failed to load conversation data:", err);
    }
  }, [pairId]);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  // ---- Auto-scroll ----
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, displayedText]);

  // ---- Focus input ----
  useEffect(() => {
    if (screen === "chat" && !viewingSession) {
      inputRef.current?.focus();
    }
  }, [screen, viewingSession]);

  // ---- Scenario helpers ----
  const getActiveScenarioRole = useCallback((): string => {
    if (selectedBuiltinId) {
      return builtinScenarios.find((s) => s.id === selectedBuiltinId)?.role ?? "partner";
    }
    // Custom scenario: parse role from system prompt or default
    return "partner";
  }, [selectedBuiltinId, builtinScenarios]);

  const getActiveScenarioTitle = useCallback((): string => {
    if (selectedBuiltinId) {
      return builtinScenarios.find((s) => s.id === selectedBuiltinId)?.title ?? "";
    }
    return selectedCustomScenario?.name ?? "";
  }, [selectedBuiltinId, builtinScenarios, selectedCustomScenario]);

  const getActiveScenarioIcon = useCallback((): string => {
    if (selectedBuiltinId) {
      return builtinScenarios.find((s) => s.id === selectedBuiltinId)?.icon ?? "\uD83D\uDCAC";
    }
    return selectedCustomScenario?.icon ?? "\uD83D\uDCAC";
  }, [selectedBuiltinId, builtinScenarios, selectedCustomScenario]);

  // ---- Build scenario prompts (role-play) ----
  const buildScenarioSystemPrompt = useCallback(
    (role: string, conversationHistory: Message[]) => {
      const history = conversationHistory
        .map((m) => `${m.role === "user" ? "Student" : role}: ${m.content}`)
        .join("\n");

      if (selectedCustomScenario) {
        return `${selectedCustomScenario.system_prompt}\n${history ? `\nConversation so far:\n${history}` : ""}`;
      }

      return `You are playing the role of a ${role} in a ${sourceName} conversation practice.
The student speaks ${targetName} natively and is learning ${sourceName} at ${level} level.
Stay in character. Speak ONLY in ${sourceName}.
After each student response, give a brief correction in ${targetName} if needed (grammar/vocab), then continue the conversation.
Keep your responses concise (2-3 sentences for the in-character part, plus correction if needed).
${history ? `\nConversation so far:\n${history}` : ""}`;
    },
    [sourceName, targetName, level, selectedCustomScenario],
  );

  const buildEvaluationPrompt = useCallback(
    (role: string, conversationHistory: Message[]) => {
      const history = conversationHistory
        .map((m) => `${m.role === "user" ? "Student" : role}: ${m.content}`)
        .join("\n");

      return `You were playing the role of a ${role} in a ${sourceName} conversation practice.
The student speaks ${targetName} natively and is learning ${sourceName} at ${level} level.

Here is the full conversation:
${history}

Now provide an evaluation of the student's performance. Respond ONLY with a JSON object in this exact format, no other text:
{"fluency": <1-5>, "grammar": <1-5>, "vocabulary": <1-5>, "corrections": ["correction 1 in ${targetName}", "correction 2 in ${targetName}"], "summary": "Brief summary in ${targetName}"}`;
    },
    [sourceName, targetName, level],
  );

  // ---- Parse evaluation JSON safely ----
  const parseEvaluation = (raw: string): Evaluation => {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as Evaluation;
      }
    } catch {
      // fall through
    }
    return { fluency: 3, grammar: 3, vocabulary: 3, corrections: [], summary: raw };
  };

  // ---- Save session to DB ----
  const persistSession = useCallback(
    async (mode: string, title: string, msgs: Message[], scenarioId: number | null = null) => {
      if (!pairId || msgs.length === 0) return;
      try {
        await bridge.saveConversationSession(pairId, scenarioId, mode, title, JSON.stringify(msgs));
      } catch (err) {
        console.error("Failed to save session:", err);
      }
    },
    [pairId],
  );

  // ===================== ACTIONS =====================

  // ---- Start preset mode ----
  const startPresetMode = useCallback((mode: PresetMode) => {
    setChatMode(mode);
    setMessages([]);
    setInput("");
    setSessionTitle(PRESET_DEFS.find((p) => p.mode === mode)?.labelKey ?? mode);
    setScreen("chat");
  }, []);

  // ---- Start scenario conversation ----
  const startBuiltinScenario = useCallback(
    async (scenarioId: string) => {
      const scenario = builtinScenarios.find((s) => s.id === scenarioId);
      if (!scenario) return;

      setSelectedBuiltinId(scenarioId);
      setSelectedCustomScenario(null);
      setChatMode("scenario");
      setMessages([]);
      setUserExchanges(0);
      setEvaluation(null);
      setSessionTitle(scenario.title);
      setScreen("chat");
      setLoading(true);

      try {
        const prompt =
          buildScenarioSystemPrompt(scenario.role, []) +
          `\n\nStart the conversation in character as the ${scenario.role}. Say your opening line in ${sourceName}.`;
        const response = await bridge.askAi(prompt);
        setMessages([{ role: "assistant", content: response }]);
      } catch (err) {
        setMessages([{ role: "assistant", content: `Error: ${err}` }]);
      } finally {
        setLoading(false);
      }
    },
    [builtinScenarios, buildScenarioSystemPrompt, sourceName],
  );

  const startCustomScenario = useCallback(
    async (scenario: ConversationScenario) => {
      setSelectedBuiltinId(null);
      setSelectedCustomScenario(scenario);
      setChatMode("scenario");
      setMessages([]);
      setUserExchanges(0);
      setEvaluation(null);
      setSessionTitle(scenario.name);
      setScreen("chat");
      setLoading(true);

      try {
        const prompt =
          scenario.system_prompt +
          `\n\nStart the conversation. Say your opening line in ${sourceName}.`;
        const response = await bridge.askAi(prompt);
        setMessages([{ role: "assistant", content: response }]);
      } catch (err) {
        setMessages([{ role: "assistant", content: `Error: ${err}` }]);
      } finally {
        setLoading(false);
      }
    },
    [sourceName],
  );

  // ---- Send message (preset mode) ----
  const sendPresetMessage = useCallback(async () => {
    if (!input.trim() || loading || !activePair) return;
    const presetDef = PRESET_DEFS.find((p) => p.mode === chatMode);
    if (!presetDef) return;

    const userMsg = input.trim();
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    // Persist user message
    bridge.saveChatMessage(activePair.id, "user", userMsg).catch(() => {});

    try {
      const systemPrompt = presetDef.buildSystemPrompt(sourceName, targetName);
      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...newMessages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      ];

      const response = await streamResponse(() => bridge.askAiConversation(apiMessages));
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);

      // Persist assistant message
      bridge.saveChatMessage(activePair.id, "assistant", response).catch(() => {});
    } catch (err) {
      const errMsg = `${t("chat.errorAi")}: ${err}`;
      setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, activePair, chatMode, messages, sourceName, targetName, streamResponse, t]);

  // ---- Send message (scenario mode) ----
  const sendScenarioMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const role = getActiveScenarioRole();
    const userMsg = input.trim();
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    const newExchangeCount = userExchanges + 1;
    setUserExchanges(newExchangeCount);
    setLoading(true);

    try {
      if (newExchangeCount >= EXCHANGE_LIMIT) {
        // Final response then evaluate
        const responsePrompt =
          buildScenarioSystemPrompt(role, newMessages) +
          "\n\nGive your final response in character, then say goodbye.";
        const response = await bridge.askAi(responsePrompt);
        const finalMessages: Message[] = [...newMessages, { role: "assistant", content: response }];
        setMessages(finalMessages);

        // Save session before evaluation
        await persistSession("scenario", getActiveScenarioTitle(), finalMessages, selectedCustomScenario?.id ?? null);

        // Evaluate
        const evalPrompt = buildEvaluationPrompt(role, finalMessages);
        const evalResponse = await bridge.askAi(evalPrompt);
        setEvaluation(parseEvaluation(evalResponse));
        setScreen("evaluation");
      } else {
        const prompt =
          buildScenarioSystemPrompt(role, newMessages) +
          "\n\nContinue the conversation in character.";
        const response = await bridge.askAi(prompt);
        setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [
    input,
    loading,
    messages,
    userExchanges,
    getActiveScenarioRole,
    getActiveScenarioTitle,
    buildScenarioSystemPrompt,
    buildEvaluationPrompt,
    persistSession,
    selectedCustomScenario,
  ]);

  // ---- End scenario early & evaluate ----
  const endAndEvaluate = useCallback(async () => {
    const role = getActiveScenarioRole();
    if (messages.length < 2) return;

    setLoading(true);
    try {
      // Save session
      await persistSession("scenario", getActiveScenarioTitle(), messages, selectedCustomScenario?.id ?? null);

      const evalPrompt = buildEvaluationPrompt(role, messages);
      const evalResponse = await bridge.askAi(evalPrompt);
      setEvaluation(parseEvaluation(evalResponse));
      setScreen("evaluation");
    } catch (err) {
      console.error("Evaluation failed:", err);
    } finally {
      setLoading(false);
    }
  }, [getActiveScenarioRole, getActiveScenarioTitle, messages, buildEvaluationPrompt, persistSession, selectedCustomScenario]);

  // ---- Unified send handler ----
  const sendMessage = useCallback(() => {
    if (chatMode === "scenario") {
      sendScenarioMessage();
    } else {
      sendPresetMessage();
    }
  }, [chatMode, sendScenarioMessage, sendPresetMessage]);

  // ---- New conversation (clear preset chat) ----
  const newConversation = useCallback(async () => {
    if (messages.length > 0 && chatMode !== "scenario") {
      await persistSession(chatMode ?? "free", sessionTitle || chatMode || "chat", messages);
    }
    setMessages([]);
    setInput("");
    if (activePair) {
      bridge.clearChatHistory(activePair.id).catch(() => {});
    }
  }, [messages, chatMode, sessionTitle, persistSession, activePair]);

  // ---- Go back to home ----
  const goHome = useCallback(async () => {
    // Save current preset conversation before leaving
    if (messages.length > 0 && chatMode !== "scenario") {
      await persistSession(chatMode ?? "free", sessionTitle || chatMode || "chat", messages);
    }
    setScreen("home");
    setChatMode(null);
    setMessages([]);
    setInput("");
    setSelectedBuiltinId(null);
    setSelectedCustomScenario(null);
    setUserExchanges(0);
    setEvaluation(null);
    setViewingSession(null);
    if (activePair) {
      bridge.clearChatHistory(activePair.id).catch(() => {});
    }
    loadHomeData();
  }, [messages, chatMode, sessionTitle, persistSession, activePair, loadHomeData]);

  // ---- Reset from evaluation to home ----
  const resetToHome = useCallback(() => {
    setScreen("home");
    setChatMode(null);
    setMessages([]);
    setInput("");
    setSelectedBuiltinId(null);
    setSelectedCustomScenario(null);
    setUserExchanges(0);
    setEvaluation(null);
    setViewingSession(null);
    loadHomeData();
  }, [loadHomeData]);

  // ---- View past session ----
  const viewSession = useCallback((session: ConversationSession) => {
    try {
      const msgs = JSON.parse(session.messages) as Message[];
      setViewingSession(session);
      setMessages(msgs);
      setScreen("chat");
      setChatMode(null);
    } catch {
      console.error("Failed to parse session messages");
    }
  }, []);

  // ---- Delete session ----
  const deleteSession = useCallback(
    async (sessionId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await bridge.deleteConversationSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [],
  );

  // ---- Create custom scenario ----
  const createCustomScenario = useCallback(async () => {
    if (!pairId || !newScenario.name.trim() || !newScenario.systemPrompt.trim()) return;
    try {
      await bridge.saveConversationScenario(
        pairId,
        newScenario.name.trim(),
        newScenario.icon.trim() || "\uD83D\uDCAC",
        newScenario.description.trim(),
        newScenario.systemPrompt.trim(),
      );
      setNewScenario({ name: "", icon: "\uD83D\uDCAC", description: "", systemPrompt: "" });
      setShowNewScenarioForm(false);
      loadHomeData();
    } catch (err) {
      console.error("Failed to create scenario:", err);
    }
  }, [pairId, newScenario, loadHomeData]);

  // ---- Delete custom scenario ----
  const deleteCustomScenario = useCallback(
    async (scenarioId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await bridge.deleteConversationScenario(scenarioId);
        setCustomScenarios((prev) => prev.filter((s) => s.id !== scenarioId));
      } catch (err) {
        console.error("Failed to delete scenario:", err);
      }
    },
    [],
  );

  // ---- Key handler ----
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ---- Stars helper ----
  function renderStars(score: number) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={18}
            className={
              i <= score
                ? "text-amber-400 fill-amber-400"
                : "text-gray-300 dark:text-gray-600"
            }
          />
        ))}
      </div>
    );
  }

  // ---- Format date helper ----
  function formatDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  }

  // ---- Mode label helper ----
  function modeLabel(mode: string): string {
    const preset = PRESET_DEFS.find((p) => p.mode === mode);
    if (preset) return t(preset.labelKey);
    if (mode === "scenario") return t("conversation.title");
    return mode;
  }

  // ===================================================================
  // RENDER: HOME SCREEN
  // ===================================================================
  if (screen === "home") {
    return (
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-100 dark:bg-teal-900/30 mb-4">
            <MessageSquare size={32} className="text-teal-600 dark:text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("conversation.title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {t("conversation.subtitle")}
          </p>
        </div>

        {/* Preset modes */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t("chat.title")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {PRESET_DEFS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.mode}
                  onClick={() => startPresetMode(preset.mode)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all text-center"
                >
                  <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                    <Icon size={20} className="text-teal-600 dark:text-teal-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight">
                    {t(preset.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Scenarios */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {t("conversation.chooseScenario")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {builtinScenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => startBuiltinScenario(scenario.id)}
                className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all text-left"
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">{scenario.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {scenario.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {scenario.description}
                  </p>
                </div>
              </button>
            ))}

            {/* Custom scenarios */}
            {customScenarios.map((scenario) => (
              <div
                key={scenario.id}
                className="relative group flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all text-left cursor-pointer"
                onClick={() => startCustomScenario(scenario)}
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">{scenario.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {scenario.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {scenario.description}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteCustomScenario(scenario.id, e)}
                  className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                  title={t("common.delete")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {/* Add custom scenario button */}
            <button
              onClick={() => setShowNewScenarioForm(true)}
              className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-teal-400 dark:hover:border-teal-600 hover:text-teal-600 dark:hover:text-teal-400 transition-all"
            >
              <Plus size={18} />
              <span className="text-sm font-medium">{t("common.add")}</span>
            </button>
          </div>
        </section>

        {/* New scenario form modal */}
        {showNewScenarioForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t("common.add")}
                </h3>
                <button
                  onClick={() => setShowNewScenarioForm(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newScenario.icon}
                    onChange={(e) => setNewScenario((s) => ({ ...s, icon: e.target.value }))}
                    className="w-14 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-2 py-2 text-center text-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                    maxLength={4}
                  />
                  <input
                    type="text"
                    value={newScenario.name}
                    onChange={(e) => setNewScenario((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Scenario name"
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <input
                  type="text"
                  value={newScenario.description}
                  onChange={(e) => setNewScenario((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Short description"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <textarea
                  value={newScenario.systemPrompt}
                  onChange={(e) => setNewScenario((s) => ({ ...s, systemPrompt: e.target.value }))}
                  placeholder="System prompt (instructions for the AI)"
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowNewScenarioForm(false)}
                    className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={createCustomScenario}
                    disabled={!newScenario.name.trim() || !newScenario.systemPrompt.trim()}
                    className="flex-1 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t("common.save")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conversation history */}
        {sessions.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Clock size={16} />
              <span>History</span>
            </h2>
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => viewSession(session)}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-400 dark:hover:border-teal-600 cursor-pointer transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Eye size={16} className="text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {modeLabel(session.mode)} &middot; {formatDate(session.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                    title={t("common.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ===================================================================
  // RENDER: EVALUATION SCREEN
  // ===================================================================
  if (screen === "evaluation" && evaluation) {
    const scores = [
      { label: t("conversation.fluency"), score: evaluation.fluency },
      { label: t("conversation.grammarScore"), score: evaluation.grammar },
      { label: t("conversation.vocabularyScore"), score: evaluation.vocabulary },
    ];

    return (
      <div className="max-w-lg mx-auto py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-teal-100 dark:bg-teal-900/30 mb-4">
            <Star size={40} className="text-teal-500 fill-teal-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("conversation.evaluation")}
          </h2>
        </div>

        {/* Scores */}
        <div className="space-y-4 mb-8">
          {scores.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {item.label}
              </span>
              {renderStars(item.score)}
            </div>
          ))}
        </div>

        {/* Corrections */}
        {evaluation.corrections.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t("conversation.corrections")}
            </h3>
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <ul className="space-y-2">
                {evaluation.corrections.map((correction, i) => (
                  <li
                    key={i}
                    className="text-sm text-amber-800 dark:text-amber-300 flex gap-2"
                  >
                    <span className="text-amber-500 flex-shrink-0">-</span>
                    {correction}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Summary */}
        {evaluation.summary && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t("conversation.summary")}
            </h3>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {evaluation.summary}
              </p>
            </div>
          </div>
        )}

        {/* Try again */}
        <button
          onClick={resetToHome}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold transition-colors"
        >
          <RotateCcw size={18} />
          {t("conversation.tryAgain")}
        </button>
      </div>
    );
  }

  // ===================================================================
  // RENDER: CHAT SCREEN (preset, scenario, or view-only replay)
  // ===================================================================
  const isViewOnly = viewingSession !== null;
  const isScenario = chatMode === "scenario";
  const isProcessing = loading || isStreaming || streamLoading;

  // Header info
  const chatTitle = isViewOnly
    ? viewingSession.title
    : isScenario
      ? getActiveScenarioTitle()
      : (PRESET_DEFS.find((p) => p.mode === chatMode)
          ? t(PRESET_DEFS.find((p) => p.mode === chatMode)!.labelKey)
          : t("chat.title"));
  const chatIcon = isScenario ? getActiveScenarioIcon() : null;
  const ChatHeaderIcon = !isScenario
    ? (PRESET_DEFS.find((p) => p.mode === chatMode)?.icon ?? MessageSquare)
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-3rem)] -m-6">
      <div className="px-6 pt-4">
        <LanguagePairBar pairs={languagePairs} activePairId={activePair?.id ?? null} onSwitch={switchPair} />
      </div>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goHome}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              {chatIcon ? (
                <span className="text-xl">{chatIcon}</span>
              ) : ChatHeaderIcon ? (
                <div className="w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <ChatHeaderIcon size={18} className="text-teal-600 dark:text-teal-400" />
                </div>
              ) : null}
              <div>
                <h1 className="text-sm font-bold text-gray-900 dark:text-white">
                  {chatTitle}
                </h1>
                {isScenario && !isViewOnly && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {userExchanges}/{EXCHANGE_LIMIT} {t("conversation.title").toLowerCase()}
                  </p>
                )}
                {isViewOnly && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {modeLabel(viewingSession.mode)} &middot; {formatDate(viewingSession.created_at)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Scenario: end & evaluate button */}
            {isScenario && !isViewOnly && messages.length >= 2 && (
              <button
                onClick={endAndEvaluate}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                <Star size={14} />
                <span className="hidden sm:inline">{t("conversation.endConversation")}</span>
              </button>
            )}

            {/* Preset: new conversation button */}
            {!isScenario && !isViewOnly && messages.length > 0 && (
              <button
                onClick={newConversation}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors disabled:opacity-50"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">{t("chat.clear")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Scenario progress bar */}
        {isScenario && !isViewOnly && (
          <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${(userExchanges / EXCHANGE_LIMIT) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50 dark:bg-gray-950">
        {/* Empty state for preset modes */}
        {messages.length === 0 && !isViewOnly && !isScenario && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mb-4">
              <MessageSquare size={32} className="text-teal-500 dark:text-teal-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t("chat.hello")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
              {t("chat.askQuestions")}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-teal-500 text-white rounded-br-md"
                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-md"
              }`}
            >
              <div
                dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
              />
            </div>
          </div>
        ))}

        {/* Streaming response (preset mode only) */}
        {(isStreaming || streamLoading) && !isScenario && (
          <div className="flex justify-start">
            <div className="max-w-[80%] sm:max-w-[70%] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              {streamLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t("chat.thinking")}</span>
                </div>
              ) : (
                <div>
                  <div
                    className="text-sm leading-relaxed text-gray-900 dark:text-gray-100"
                    dangerouslySetInnerHTML={{ __html: formatMessage(displayedText) }}
                  />
                  <button
                    onClick={stopStream}
                    className="mt-1 flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600"
                  >
                    <X size={8} /> {t("chat.stop")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading indicator (scenario mode or fallback) */}
        {loading && !isStreaming && !streamLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                <span>{t("chat.thinking")}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input (hidden when viewing past session) */}
      {!isViewOnly && (
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("chat.typePlaceholder")}
                disabled={isProcessing}
                rows={1}
                className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-3 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 transition-colors"
                style={{ maxHeight: "120px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isProcessing}
              className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-teal-500 hover:bg-teal-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-teal-500 shadow-sm"
            >
              {isProcessing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
            {t("chat.shiftEnter")}
          </p>
        </div>
      )}

      {/* View-only footer */}
      {isViewOnly && (
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          <button
            onClick={goHome}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft size={16} />
            {t("common.back")}
          </button>
        </div>
      )}
    </div>
  );
}
