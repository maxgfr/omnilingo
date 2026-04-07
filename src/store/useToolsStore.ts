import { create } from "zustand";

interface ToolState {
  input: string;
  result: unknown;
  fallback: string | null;
}

type ToolName = "rephrase" | "corrector" | "synonyms" | "textAnalysis";

interface ToolsState {
  tools: Record<ToolName, ToolState>;
  setToolInput: (tool: ToolName, input: string) => void;
  setToolResult: (tool: ToolName, result: unknown) => void;
  setToolFallback: (tool: ToolName, fallback: string | null) => void;
  resetTool: (tool: ToolName) => void;
}

const emptyTool: ToolState = { input: "", result: null, fallback: null };

export const useToolsStore = create<ToolsState>((set) => ({
  tools: {
    rephrase: { ...emptyTool },
    corrector: { ...emptyTool },
    synonyms: { ...emptyTool },
    textAnalysis: { ...emptyTool },
  },
  setToolInput: (tool, input) =>
    set((state) => ({
      tools: { ...state.tools, [tool]: { ...state.tools[tool], input } },
    })),
  setToolResult: (tool, result) =>
    set((state) => ({
      tools: { ...state.tools, [tool]: { ...state.tools[tool], result } },
    })),
  setToolFallback: (tool, fallback) =>
    set((state) => ({
      tools: { ...state.tools, [tool]: { ...state.tools[tool], fallback } },
    })),
  resetTool: (tool) =>
    set((state) => ({
      tools: { ...state.tools, [tool]: { ...emptyTool } },
    })),
}));
