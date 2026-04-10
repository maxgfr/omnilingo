import { describe, it, expect } from "vitest";
import {
  REPHRASE_EXAMPLE,
  CORRECTOR_EXAMPLE,
  SYNONYMS_EXAMPLE,
  MINING_SAMPLE_INPUT,
  MINING_EXAMPLE,
  CONJUGATION_EXAMPLE,
  GRAMMAR_EXAMPLE,
  CONVERSATION_EXAMPLE,
} from "../lib/exampleData";

// Base examples are always in English. AI translation per language pair is
// handled at runtime by exampleTranslations.ts and applied by views via the
// useExampleTranslations hook.

function looksEnglish(text: string): boolean {
  return /\b(?:the|is|are|was|were|have|has|been|this|that|with|from|they|their|would|could|should|and|of|to|in|for|a|an)\b/i.test(
    text,
  );
}

describe("Example data is English (base)", () => {
  describe("REPHRASE_EXAMPLE", () => {
    it("sample input is English", () => {
      expect(looksEnglish(REPHRASE_EXAMPLE.sampleInput)).toBe(true);
    });
    it("alternatives are English", () => {
      for (const alt of REPHRASE_EXAMPLE.alternatives) {
        expect(looksEnglish(alt.text)).toBe(true);
        expect(alt.note.length).toBeGreaterThan(0);
      }
    });
  });

  describe("CORRECTOR_EXAMPLE", () => {
    it("sample input and corrected text are English", () => {
      expect(looksEnglish(CORRECTOR_EXAMPLE.sampleInput)).toBe(true);
      expect(looksEnglish(CORRECTOR_EXAMPLE.corrected)).toBe(true);
    });
    it("each correction has wrong/right/explanation", () => {
      for (const c of CORRECTOR_EXAMPLE.corrections) {
        expect(c.wrong.length).toBeGreaterThan(0);
        expect(c.right.length).toBeGreaterThan(0);
        expect(c.explanation.length).toBeGreaterThan(0);
      }
    });
  });

  describe("SYNONYMS_EXAMPLE", () => {
    it("sample input is a non-empty word", () => {
      expect(SYNONYMS_EXAMPLE.sampleInput.length).toBeGreaterThan(0);
    });
    it("each synonym has word, register, definition, example", () => {
      for (const s of SYNONYMS_EXAMPLE.synonyms) {
        expect(s.word.length).toBeGreaterThan(0);
        expect(s.definition.length).toBeGreaterThan(0);
        expect(s.example.source.length).toBeGreaterThan(0);
        expect(s.example.target.length).toBeGreaterThan(0);
      }
    });
  });

  describe("MINING examples", () => {
    it("sample input is English", () => {
      expect(looksEnglish(MINING_SAMPLE_INPUT)).toBe(true);
    });
    it("each mined sentence has translation, keyWords, grammar", () => {
      for (const s of MINING_EXAMPLE) {
        expect(s.sentence.length).toBeGreaterThan(0);
        expect(s.translation.length).toBeGreaterThan(0);
        expect(s.grammar.length).toBeGreaterThan(0);
        for (const kw of s.keyWords) {
          expect(kw.word.length).toBeGreaterThan(0);
          expect(kw.translation.length).toBeGreaterThan(0);
          expect(["A1", "A2", "B1", "B2", "C1", "C2"]).toContain(kw.level);
        }
      }
    });
  });

  describe("CONJUGATION_EXAMPLE", () => {
    it("has 6 persons and 6 forms", () => {
      expect(CONJUGATION_EXAMPLE.persons).toHaveLength(6);
      expect(CONJUGATION_EXAMPLE.forms).toHaveLength(6);
    });
    it("infinitive and translation are non-empty", () => {
      expect(CONJUGATION_EXAMPLE.infinitive.length).toBeGreaterThan(0);
      expect(CONJUGATION_EXAMPLE.translation.length).toBeGreaterThan(0);
    });
  });

  describe("GRAMMAR_EXAMPLE", () => {
    it("has a title, explanation, and examples", () => {
      expect(GRAMMAR_EXAMPLE.title.length).toBeGreaterThan(0);
      expect(GRAMMAR_EXAMPLE.explanation.length).toBeGreaterThan(0);
      expect(GRAMMAR_EXAMPLE.examples.length).toBeGreaterThan(0);
    });
    it("has valid CEFR level", () => {
      expect(["A1", "A2", "B1", "B2", "C1", "C2"]).toContain(GRAMMAR_EXAMPLE.level);
    });
  });

  describe("CONVERSATION_EXAMPLE", () => {
    it("has assistant and user messages", () => {
      const roles = CONVERSATION_EXAMPLE.map((m) => m.role);
      expect(roles).toContain("assistant");
      expect(roles).toContain("user");
      for (const msg of CONVERSATION_EXAMPLE) {
        expect(looksEnglish(msg.content)).toBe(true);
      }
    });
  });
});
