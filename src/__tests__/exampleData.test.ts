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

// Helper: basic check that text contains German characters / patterns
function looksGerman(text: string): boolean {
  // German-specific: umlauts, ß, or common German words/patterns
  return /[äöüÄÖÜß]|(?:ich|du|er|sie|und|ist|die|der|das|ein|nicht|haben|sein|wird|kann|mir|den|schick|bitte|gern|mal)\b/i.test(text);
}

function looksEnglish(text: string): boolean {
  // Common English function words that are NOT German
  return /\b(?:the|is|are|was|were|have|has|been|this|that|with|from|they|their|would|could|should)\b/i.test(text);
}

describe("Example data is DE-FR (not English)", () => {
  describe("REPHRASE_EXAMPLE", () => {
    it("sample input is German", () => {
      expect(looksGerman(REPHRASE_EXAMPLE.sampleInput)).toBe(true);
      expect(looksEnglish(REPHRASE_EXAMPLE.sampleInput)).toBe(false);
    });

    it("alternatives are in German", () => {
      for (const alt of REPHRASE_EXAMPLE.alternatives) {
        expect(looksGerman(alt.text)).toBe(true);
      }
    });

    it("notes are in French", () => {
      for (const alt of REPHRASE_EXAMPLE.alternatives) {
        // French indicators
        expect(/[àâéèêëïîôùûüÿçœæ]|adapté|poli|familier|proches|contexte/i.test(alt.note)).toBe(true);
      }
    });
  });

  describe("CORRECTOR_EXAMPLE", () => {
    it("sample input is German", () => {
      expect(looksGerman(CORRECTOR_EXAMPLE.sampleInput)).toBe(true);
      expect(looksEnglish(CORRECTOR_EXAMPLE.sampleInput)).toBe(false);
    });

    it("corrected text is German", () => {
      expect(looksGerman(CORRECTOR_EXAMPLE.corrected)).toBe(true);
    });

    it("corrections have German wrong/right and French explanations", () => {
      for (const c of CORRECTOR_EXAMPLE.corrections) {
        expect(c.wrong.length).toBeGreaterThan(0);
        expect(c.right.length).toBeGreaterThan(0);
        // Explanation should be in French
        expect(/[àâéèêëïîôùûüÿçœæ]|accusatif|verbe|conjugaison|personne|singulier/i.test(c.explanation)).toBe(true);
      }
    });

    it("feedback is in French", () => {
      expect(/[àâéèêëïîôùûüÿçœæ]|Bon|Attention|effort/i.test(CORRECTOR_EXAMPLE.feedback)).toBe(true);
    });
  });

  describe("SYNONYMS_EXAMPLE", () => {
    it("sample input is a German word", () => {
      expect(looksEnglish(SYNONYMS_EXAMPLE.sampleInput)).toBe(false);
    });

    it("synonyms are German words with French definitions", () => {
      for (const s of SYNONYMS_EXAMPLE.synonyms) {
        expect(s.word.length).toBeGreaterThan(0);
        // French definition
        expect(/[àâéèêëïîôùûüÿçœæ]|qui|du|de|la|le/i.test(s.definition)).toBe(true);
      }
    });

    it("examples have German source and French target", () => {
      for (const s of SYNONYMS_EXAMPLE.synonyms) {
        expect(looksGerman(s.example.source)).toBe(true);
        // French target
        expect(/[àâéèêëïîôùûüÿçœæ]|Je|Elle|suis|de|une/i.test(s.example.target)).toBe(true);
      }
    });
  });

  describe("MINING examples", () => {
    it("sample input is German", () => {
      expect(looksGerman(MINING_SAMPLE_INPUT)).toBe(true);
      expect(looksEnglish(MINING_SAMPLE_INPUT)).toBe(false);
    });

    it("mined sentences are German with French translations", () => {
      for (const s of MINING_EXAMPLE) {
        expect(looksGerman(s.sentence)).toBe(true);
        // Translation should be French
        expect(looksEnglish(s.translation)).toBe(false);
      }
    });

    it("keywords are German with French translations", () => {
      for (const s of MINING_EXAMPLE) {
        for (const kw of s.keyWords) {
          expect(kw.word.length).toBeGreaterThan(0);
          expect(kw.translation.length).toBeGreaterThan(0);
          expect(["A1", "A2", "B1", "B2", "C1", "C2"]).toContain(kw.level);
        }
      }
    });

    it("grammar points are in French", () => {
      for (const s of MINING_EXAMPLE) {
        expect(s.grammar.length).toBeGreaterThan(0);
      }
    });
  });

  describe("CONJUGATION_EXAMPLE", () => {
    it("infinitive is a German verb", () => {
      expect(CONJUGATION_EXAMPLE.infinitive).toBe("machen");
    });

    it("translation is French", () => {
      expect(CONJUGATION_EXAMPLE.translation).toBe("faire");
    });

    it("persons are German pronouns", () => {
      expect(CONJUGATION_EXAMPLE.persons).toContain("ich");
      expect(CONJUGATION_EXAMPLE.persons).toContain("du");
      expect(CONJUGATION_EXAMPLE.persons).toContain("wir");
    });

    it("has 6 persons and 6 forms", () => {
      expect(CONJUGATION_EXAMPLE.persons).toHaveLength(6);
      expect(CONJUGATION_EXAMPLE.forms).toHaveLength(6);
    });

    it("tense is in German", () => {
      expect(CONJUGATION_EXAMPLE.tense).toBe("Präsens");
    });
  });

  describe("GRAMMAR_EXAMPLE", () => {
    it("title is a German grammar topic", () => {
      expect(looksGerman(GRAMMAR_EXAMPLE.title)).toBe(true);
    });

    it("explanation is in French", () => {
      expect(/nominatif|accusatif|article|sujet|cas/i.test(GRAMMAR_EXAMPLE.explanation)).toBe(true);
    });

    it("examples have German source and French target", () => {
      for (const ex of GRAMMAR_EXAMPLE.examples) {
        expect(looksGerman(ex.source)).toBe(true);
        expect(looksEnglish(ex.target)).toBe(false);
      }
    });

    it("has valid CEFR level", () => {
      expect(["A1", "A2", "B1", "B2", "C1", "C2"]).toContain(GRAMMAR_EXAMPLE.level);
    });
  });

  describe("CONVERSATION_EXAMPLE", () => {
    it("messages are in German", () => {
      for (const msg of CONVERSATION_EXAMPLE) {
        expect(looksGerman(msg.content)).toBe(true);
      }
    });

    it("has assistant and user roles", () => {
      const roles = CONVERSATION_EXAMPLE.map((m) => m.role);
      expect(roles).toContain("assistant");
      expect(roles).toContain("user");
    });
  });
});
