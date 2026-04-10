import { describe, it, expect } from "vitest";
import {
  formatDefinition,
  parseTargetWord,
  levelColors,
  genderBadges,
  normalizeForSearch,
  extractTranslationsWithWordSet,
} from "../lib/wordUtils";

// ─────────────────────────────────────────────────────────────────────
// formatDefinition
// ─────────────────────────────────────────────────────────────────────
describe("formatDefinition", () => {
  it("returns single-element array for simple text", () => {
    expect(formatDefinition("maison")).toEqual(["maison"]);
  });

  it("splits on semicolons", () => {
    expect(formatDefinition("maison; habitation; demeure")).toEqual([
      "maison",
      "habitation",
      "demeure",
    ]);
  });

  it("trims whitespace around semicolons", () => {
    const result = formatDefinition("chat  ;  félin");
    expect(result).toEqual(["chat", "félin"]);
  });

  it("returns original text when only one part after split", () => {
    expect(formatDefinition("le chien")).toEqual(["le chien"]);
  });

  it("filters empty parts from consecutive semicolons", () => {
    const result = formatDefinition("a ;; b");
    expect(result).toEqual(["a", "b"]);
  });

  it("handles empty string", () => {
    expect(formatDefinition("")).toEqual([""]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// parseTargetWord
// ─────────────────────────────────────────────────────────────────────
describe("parseTargetWord", () => {
  it("extracts IPA from /.../ pattern", () => {
    const result = parseTargetWord("/mɛ.zɔ̃/ maison");
    expect(result.ipa).toBe("/mɛ.zɔ̃/");
    expect(result.clean).toBe("maison");
  });

  it("extracts POS at start of text", () => {
    const result = parseTargetWord("verb faire quelque chose");
    expect(result.pos).toBe("verb");
    expect(result.clean).toBe("faire quelque chose");
  });

  it("extracts both IPA and POS", () => {
    const result = parseTargetWord("/haʊs/ noun maison");
    expect(result.ipa).toBe("/haʊs/");
    expect(result.pos).toBe("noun");
    expect(result.clean).toBe("maison");
  });

  it("uses category as POS fallback", () => {
    const result = parseTargetWord("maison", "noun");
    expect(result.pos).toBe("noun");
    expect(result.clean).toBe("maison");
  });

  it("does not use 'dictionary' category as POS", () => {
    const result = parseTargetWord("maison", "dictionary");
    expect(result.pos).toBeNull();
  });

  it("does not use 'sentence' category as POS", () => {
    const result = parseTargetWord("maison", "sentence");
    expect(result.pos).toBeNull();
  });

  it("uses tags as IPA fallback", () => {
    const result = parseTargetWord("maison", null, "/mɛ.zɔ̃/");
    expect(result.ipa).toBe("/mɛ.zɔ̃/");
  });

  it("does not use tags without /.../ as IPA", () => {
    const result = parseTargetWord("maison", null, "some tag");
    expect(result.ipa).toBeNull();
  });

  it("strips gender artifacts (female)", () => {
    const result = parseTargetWord(", female la maison");
    expect(result.clean).toBe("la maison");
  });

  it("strips gender artifacts (masculine)", () => {
    const result = parseTargetWord(", masculine le chien");
    expect(result.clean).toBe("le chien");
  });

  it("handles null category and tags", () => {
    const result = parseTargetWord("maison", null, null);
    expect(result.clean).toBe("maison");
    expect(result.ipa).toBeNull();
    expect(result.pos).toBeNull();
  });

  it("handles empty string", () => {
    const result = parseTargetWord("");
    expect(result.clean).toBe("");
    expect(result.ipa).toBeNull();
    expect(result.pos).toBeNull();
  });

  it("handles leading semicolons after IPA removal", () => {
    const result = parseTargetWord("/abc/; maison");
    expect(result.ipa).toBe("/abc/");
    expect(result.clean).toBe("maison");
  });

  it("recognizes French POS terms", () => {
    const result = parseTargetWord("adjectif grand");
    expect(result.pos).toBe("adjectif");
    expect(result.clean).toBe("grand");
  });
});

// ─────────────────────────────────────────────────────────────────────
// levelColors
// ─────────────────────────────────────────────────────────────────────
describe("levelColors", () => {
  const expectedLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];

  it("has entries for all CEFR levels", () => {
    for (const level of expectedLevels) {
      expect(levelColors[level]).toBeDefined();
      expect(levelColors[level].length).toBeGreaterThan(0);
    }
  });

  it("values are CSS class strings", () => {
    for (const level of expectedLevels) {
      expect(levelColors[level]).toContain("bg-");
      expect(levelColors[level]).toContain("text-");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// genderBadges
// ─────────────────────────────────────────────────────────────────────
describe("genderBadges", () => {
  it("has entries for m, f, n", () => {
    expect(genderBadges.m).toBeDefined();
    expect(genderBadges.f).toBeDefined();
    expect(genderBadges.n).toBeDefined();
  });

  it("uses correct German articles", () => {
    expect(genderBadges.m.label).toBe("der");
    expect(genderBadges.f.label).toBe("die");
    expect(genderBadges.n.label).toBe("das");
  });

  it("has non-empty color strings", () => {
    expect(genderBadges.m.color.length).toBeGreaterThan(0);
    expect(genderBadges.f.color.length).toBeGreaterThan(0);
    expect(genderBadges.n.color.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// normalizeForSearch
// ─────────────────────────────────────────────────────────────────────
describe("normalizeForSearch", () => {
  it("strips accents from French characters", () => {
    expect(normalizeForSearch("café")).toBe("cafe");
    expect(normalizeForSearch("élève")).toBe("eleve");
    expect(normalizeForSearch("à â è ù")).toBe("a a e u");
  });

  it("strips accents from German characters", () => {
    expect(normalizeForSearch("über")).toBe("uber");
    expect(normalizeForSearch("Äpfel")).toBe("apfel");
    expect(normalizeForSearch("Österreich")).toBe("osterreich");
  });

  it("converts ß to ss", () => {
    expect(normalizeForSearch("Straße")).toBe("strasse");
    expect(normalizeForSearch("Fuß")).toBe("fuss");
  });

  it("converts æ/œ to ae/oe", () => {
    expect(normalizeForSearch("Cœur")).toBe("coeur");
    expect(normalizeForSearch("æsthetic")).toBe("aesthetic");
  });

  it("is case-insensitive", () => {
    expect(normalizeForSearch("HAUS")).toBe("haus");
    expect(normalizeForSearch("Haus")).toBe("haus");
    expect(normalizeForSearch("haus")).toBe("haus");
  });

  it("leaves ASCII characters unchanged", () => {
    expect(normalizeForSearch("house")).toBe("house");
    expect(normalizeForSearch("123")).toBe("123");
  });

  it("handles empty string", () => {
    expect(normalizeForSearch("")).toBe("");
  });

  it("handles ñ and ç", () => {
    expect(normalizeForSearch("niño")).toBe("nino");
    expect(normalizeForSearch("français")).toBe("francais");
  });
});

// ─────────────────────────────────────────────────────────────────────
// extractTranslationsWithWordSet
// ─────────────────────────────────────────────────────────────────────
describe("extractTranslationsWithWordSet", () => {
  const reverseWords = new Set(["maison", "chat", "chien", "livre", "grand", "petit"]);

  it("returns short text as translation", () => {
    const result = extractTranslationsWithWordSet("maison", reverseWords);
    expect(result.translation).toBe("maison");
    expect(result.definition).toBeNull();
  });

  it("extracts known words from longer text", () => {
    const result = extractTranslationsWithWordSet("maison building where people live", reverseWords);
    expect(result.translation).toContain("maison");
    expect(result.definition).toBeTruthy();
  });

  it("extracts multiple known words", () => {
    const words = new Set(["maison", "chat"]);
    const result = extractTranslationsWithWordSet("maison chat other words here", words);
    expect(result.translation).toContain("maison");
    expect(result.translation).toContain("chat");
  });

  it("returns the whole text as translation when no words match and no definition marker", () => {
    const result = extractTranslationsWithWordSet("completely unknown text here", reverseWords);
    // No reverse-set matches and no definition marker → fall back to treating
    // the whole text as a single translation phrase rather than fragmenting it.
    expect(result.translation).toBe("completely unknown text here");
    expect(result.definition).toBeNull();
  });

  it("handles text with definition markers (parentheses)", () => {
    const words = new Set(["maison"]);
    const result = extractTranslationsWithWordSet("maison (building) chat (animal)", words);
    expect(result.translation).toContain("maison");
  });

  it("handles empty text", () => {
    const result = extractTranslationsWithWordSet("", reverseWords);
    expect(result.translation).toBeNull();
    expect(result.definition).toBeNull();
  });

  it("performs accent-insensitive matching", () => {
    const words = new Set(["cafe"]);
    const result = extractTranslationsWithWordSet("café building", words);
    expect(result.translation).toContain("café");
  });
});
