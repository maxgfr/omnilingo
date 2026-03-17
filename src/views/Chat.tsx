import { useEffect, useState, useRef, useCallback } from "react";
import { Send, Sparkles, Loader2, Trash2 } from "lucide-react";
import { useApp } from "../store/AppContext";
import * as bridge from "../lib/bridge";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_ACTIONS = [
  { label: "Correct a sentence", prompt: "Corrige cette phrase et explique les erreurs : " },
  { label: "Explain grammar", prompt: "Explique-moi cette regle de grammaire : " },
  { label: "Free conversation", prompt: "Parlons dans la langue cible ! Commence une conversation simple sur " },
  { label: "Exercises", prompt: "Donne-moi 5 exercices de niveau " },
  { label: "Translate", prompt: "Traduis dans la langue cible : " },
];

const MAX_MESSAGES = 20;
const STORAGE_KEY = "omnilingo-chat";

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

function formatMessage(text: string): string {
  let escaped = escapeHtml(text);
  // Bold: **text**
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic: *text*
  escaped = escaped.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Inline code: `text`
  escaped = escaped.replace(
    /`([^`]+)`/g,
    '<code class="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono">$1</code>',
  );
  // Line breaks
  escaped = escaped.replace(/\n/g, "<br />");
  return escaped;
}

export default function Chat() {
  const { settings, activePair } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Save to sessionStorage on change
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const buildPrompt = useCallback(
    async (userMessage: string) => {
      const errors = await bridge.readMemoryFile("errors.md").catch(() => null);
      const level = settings?.level || "A2";
      const sourceName = activePair?.source_name || "Allemand";
      const targetName = activePair?.target_name || "Francais";

      const history = messages
        .slice(-6)
        .map((m) => `${m.role === "user" ? "Eleve" : "Tuteur"}: ${m.content}`)
        .join("\n");

      const context = `Tu es un tuteur de langues expert, patient et encourageant. L'eleve apprend le ${sourceName} (langue cible) depuis le ${targetName} (langue maternelle).
Son niveau CECRL est ${level}. Adapte tes reponses a ce niveau : vocabulaire simple pour A1-A2, plus complexe pour B1+.
Reponds toujours en ${targetName}, sauf quand tu donnes des exemples dans la langue cible.
Utilise des exemples concrets et corrige les erreurs avec bienveillance.
${errors ? `\nErreurs recentes de l'eleve (a cibler dans tes reponses):\n${errors.slice(0, 500)}` : ""}
${history ? `\nHistorique recent de la conversation:\n${history}` : ""}
\nMessage de l'eleve: ${userMessage}`;
      return context;
    },
    [settings, activePair, messages],
  );

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const prompt = await buildPrompt(userMsg);
      const response = await bridge.askAi(prompt);
      setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), { role: "assistant", content: response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error communicating with AI: ${err}` },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, buildPrompt]);

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const clearChat = () => {
    setMessages([]);
    sessionStorage.removeItem(STORAGE_KEY);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-3rem)] -m-6">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Sparkles size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">AI Chat</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {activePair
                  ? `Tutor ${activePair.source_name} - Level ${settings?.level || "A2"}`
                  : "Language tutor"}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Clear conversation"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.prompt)}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 dark:hover:bg-amber-900/20 dark:hover:border-amber-700 dark:hover:text-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50 dark:bg-gray-950">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
              <Sparkles size={32} className="text-purple-500 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Hello! I'm your AI tutor
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
              Ask me questions, request corrections, or practice conversation.
              Use the quick buttons above to get started.
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
                  ? "bg-amber-500 text-white rounded-br-md"
                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-md"
              }`}
            >
              <div
                dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
              />
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 size={16} className="animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={loading}
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-3 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 transition-colors"
              style={{ maxHeight: "120px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
            />
          </div>
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500 shadow-sm"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
          Shift+Enter for new line - Enter to send
        </p>
      </div>
    </div>
  );
}
