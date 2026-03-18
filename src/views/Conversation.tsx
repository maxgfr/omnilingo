import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Send,
  Loader2,
  RotateCcw,
  Star,
  ArrowLeft,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";

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

type Phase = "setup" | "conversation" | "evaluation";

const EXCHANGE_LIMIT = 8;

export default function Conversation() {
  const { t } = useTranslation();
  const { settings, activePair } = useApp();

  const scenarios = [
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
  ];

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userExchanges, setUserExchanges] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (phase === "conversation") {
      inputRef.current?.focus();
    }
  }, [phase]);

  const sourceName = activePair?.source_name || "the target language";
  const targetName = activePair?.target_name || "the native language";
  const level = settings?.level || "A2";

  const getScenario = useCallback(
    () => scenarios.find((s) => s.id === selectedScenario),
    [selectedScenario, scenarios],
  );

  const buildSystemPrompt = useCallback(
    (scenario: { role: string }, conversationHistory: Message[]) => {
      const history = conversationHistory
        .map((m) => `${m.role === "user" ? "Student" : scenario.role}: ${m.content}`)
        .join("\n");

      return `You are playing the role of a ${scenario.role} in a ${sourceName} conversation practice.
The student speaks ${targetName} natively and is learning ${sourceName} at ${level} level.
Stay in character. Speak ONLY in ${sourceName}.
After each student response, give a brief correction in ${targetName} if needed (grammar/vocab), then continue the conversation.
Keep your responses concise (2-3 sentences for the in-character part, plus correction if needed).
${history ? `\nConversation so far:\n${history}` : ""}`;
    },
    [sourceName, targetName, level],
  );

  const buildEvaluationPrompt = useCallback(
    (scenario: { role: string }, conversationHistory: Message[]) => {
      const history = conversationHistory
        .map((m) => `${m.role === "user" ? "Student" : scenario.role}: ${m.content}`)
        .join("\n");

      return `You were playing the role of a ${scenario.role} in a ${sourceName} conversation practice.
The student speaks ${targetName} natively and is learning ${sourceName} at ${level} level.

Here is the full conversation:
${history}

Now provide an evaluation of the student's performance. Respond ONLY with a JSON object in this exact format, no other text:
{"fluency": <1-5>, "grammar": <1-5>, "vocabulary": <1-5>, "corrections": ["correction 1 in ${targetName}", "correction 2 in ${targetName}"], "summary": "Brief summary in ${targetName}"}`;
    },
    [sourceName, targetName, level],
  );

  const startConversation = useCallback(async () => {
    if (!selectedScenario) return;
    const scenario = scenarios.find((s) => s.id === selectedScenario);
    if (!scenario) return;

    setPhase("conversation");
    setMessages([]);
    setUserExchanges(0);
    setLoading(true);

    try {
      const prompt = buildSystemPrompt(scenario, []) +
        `\n\nStart the conversation in character as the ${scenario.role}. Say your opening line in ${sourceName}.`;
      const response = await bridge.askAi(prompt);
      setMessages([{ role: "assistant", content: response }]);
    } catch (err) {
      setMessages([
        { role: "assistant", content: `Error: ${err}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [selectedScenario, scenarios, buildSystemPrompt, sourceName]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const scenario = getScenario();
    if (!scenario) return;

    const userMsg = input.trim();
    setInput("");

    const newMessages: Message[] = [
      ...messages,
      { role: "user" as const, content: userMsg },
    ];
    setMessages(newMessages);
    const newExchangeCount = userExchanges + 1;
    setUserExchanges(newExchangeCount);
    setLoading(true);

    try {
      // Check if we should end the conversation
      if (newExchangeCount >= EXCHANGE_LIMIT) {
        // Get final response then evaluate
        const responsePrompt =
          buildSystemPrompt(scenario, newMessages) +
          "\n\nGive your final response in character, then say goodbye.";
        const response = await bridge.askAi(responsePrompt);
        const finalMessages: Message[] = [
          ...newMessages,
          { role: "assistant" as const, content: response },
        ];
        setMessages(finalMessages);

        // Now get evaluation
        const evalPrompt = buildEvaluationPrompt(scenario, finalMessages);
        const evalResponse = await bridge.askAi(evalPrompt);

        try {
          // Try to extract JSON from the response
          const jsonMatch = evalResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const evalData = JSON.parse(jsonMatch[0]) as Evaluation;
            setEvaluation(evalData);
            setPhase("evaluation");
          } else {
            setEvaluation({
              fluency: 3,
              grammar: 3,
              vocabulary: 3,
              corrections: [],
              summary: evalResponse,
            });
            setPhase("evaluation");
          }
        } catch {
          setEvaluation({
            fluency: 3,
            grammar: 3,
            vocabulary: 3,
            corrections: [],
            summary: evalResponse,
          });
          setPhase("evaluation");
        }
      } else {
        const prompt =
          buildSystemPrompt(scenario, newMessages) +
          "\n\nContinue the conversation in character.";
        const response = await bridge.askAi(prompt);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err}` },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [
    input,
    loading,
    messages,
    userExchanges,
    getScenario,
    buildSystemPrompt,
    buildEvaluationPrompt,
  ]);

  const endAndEvaluate = useCallback(async () => {
    const scenario = getScenario();
    if (!scenario || messages.length < 2) return;

    setLoading(true);
    try {
      const evalPrompt = buildEvaluationPrompt(scenario, messages);
      const evalResponse = await bridge.askAi(evalPrompt);

      try {
        const jsonMatch = evalResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const evalData = JSON.parse(jsonMatch[0]) as Evaluation;
          setEvaluation(evalData);
        } else {
          setEvaluation({
            fluency: 3,
            grammar: 3,
            vocabulary: 3,
            corrections: [],
            summary: evalResponse,
          });
        }
      } catch {
        setEvaluation({
          fluency: 3,
          grammar: 3,
          vocabulary: 3,
          corrections: [],
          summary: evalResponse,
        });
      }
      setPhase("evaluation");
    } catch (err) {
      console.error("Evaluation failed:", err);
    } finally {
      setLoading(false);
    }
  }, [getScenario, messages, buildEvaluationPrompt]);

  const resetConversation = () => {
    setPhase("setup");
    setSelectedScenario(null);
    setMessages([]);
    setUserExchanges(0);
    setEvaluation(null);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // --- Score stars ---
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

  // --- Setup screen ---
  if (phase === "setup") {
    return (
      <div>
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

        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          {t("conversation.chooseScenario")}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => setSelectedScenario(scenario.id)}
              className={`flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all ${
                selectedScenario === scenario.id
                  ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 shadow-sm"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-teal-300 dark:hover:border-teal-600"
              }`}
            >
              <span className="text-3xl flex-shrink-0 mt-0.5">{scenario.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {scenario.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {scenario.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={startConversation}
          disabled={!selectedScenario}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-semibold transition-colors shadow-sm"
        >
          <MessageSquare size={22} />
          {t("conversation.start")}
        </button>
      </div>
    );
  }

  // --- Evaluation screen ---
  if (phase === "evaluation" && evaluation) {
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
          onClick={resetConversation}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold transition-colors"
        >
          <RotateCcw size={18} />
          {t("conversation.tryAgain")}
        </button>
      </div>
    );
  }

  // --- Conversation screen ---
  const scenario = getScenario();

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-3rem)] -m-6">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={resetConversation}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl">{scenario?.icon}</span>
              <div>
                <h1 className="text-sm font-bold text-gray-900 dark:text-white">
                  {scenario?.title}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {userExchanges}/{EXCHANGE_LIMIT} {t("conversation.title").toLowerCase()}
                </p>
              </div>
            </div>
          </div>
          {messages.length >= 2 && (
            <button
              onClick={endAndEvaluate}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <Star size={14} />
              <span className="hidden sm:inline">{t("conversation.endConversation")}</span>
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-300"
            style={{ width: `${(userExchanges / EXCHANGE_LIMIT) * 100}%` }}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50 dark:bg-gray-950">
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
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
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

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.typePlaceholder")}
              disabled={loading}
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
            disabled={!input.trim() || loading}
            className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-teal-500 hover:bg-teal-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-teal-500 shadow-sm"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
