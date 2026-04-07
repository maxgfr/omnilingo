import { create } from "zustand";

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

type Screen = "home" | "chat" | "evaluation";
type ChatMode = "correct" | "grammar" | "free" | "exercises" | "translate" | "scenario" | null;

interface ConversationState {
  screen: Screen;
  chatMode: ChatMode;
  messages: Message[];
  input: string;
  sessionTitle: string;
  evaluation: Evaluation | null;
  selectedBuiltinId: string | null;
  userExchanges: number;
  setScreen: (s: Screen) => void;
  setChatMode: (m: ChatMode) => void;
  setMessages: (m: Message[] | ((prev: Message[]) => Message[])) => void;
  setInput: (i: string) => void;
  setSessionTitle: (t: string) => void;
  setEvaluation: (e: Evaluation | null) => void;
  setSelectedBuiltinId: (id: string | null) => void;
  setUserExchanges: (n: number | ((prev: number) => number)) => void;
  resetToHome: () => void;
}

const initialState = {
  screen: "home" as Screen,
  chatMode: null as ChatMode,
  messages: [] as Message[],
  input: "",
  sessionTitle: "",
  evaluation: null as Evaluation | null,
  selectedBuiltinId: null as string | null,
  userExchanges: 0,
};

export const useConversationStore = create<ConversationState>((set) => ({
  ...initialState,
  setScreen: (screen) => set({ screen }),
  setChatMode: (chatMode) => set({ chatMode }),
  setMessages: (m) =>
    set((state) => ({
      messages: typeof m === "function" ? m(state.messages) : m,
    })),
  setInput: (input) => set({ input }),
  setSessionTitle: (sessionTitle) => set({ sessionTitle }),
  setEvaluation: (evaluation) => set({ evaluation }),
  setSelectedBuiltinId: (selectedBuiltinId) => set({ selectedBuiltinId }),
  setUserExchanges: (n) =>
    set((state) => ({
      userExchanges: typeof n === "function" ? n(state.userExchanges) : n,
    })),
  resetToHome: () => set(initialState),
}));
