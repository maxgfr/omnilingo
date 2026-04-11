import { describe, it, expect } from "vitest";
import { levelColors } from "../lib/wordUtils";

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
