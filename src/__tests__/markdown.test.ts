import { describe, it, expect, vi } from "vitest";

vi.mock("../lib/bridge", () => ({
  readMemoryFile: vi.fn().mockResolvedValue(null),
}));

// ─────────────────────────────────────────────────────────────────────
// formatMessage
// ─────────────────────────────────────────────────────────────────────
describe("formatMessage", () => {
  it("converts bold to <strong> with dark-mode classes", async () => {
    const { formatMessage } = await import("../lib/markdown");
    const result = formatMessage("**bold** text");
    // Strong tags carry explicit dark-mode classes so the rendered HTML
    // stays readable on dark backgrounds (the project doesn't ship the
    // @tailwindcss/typography plugin).
    expect(result).toMatch(/<strong[^>]*>bold<\/strong>/);
    expect(result).toContain("dark:text-white");
  });

  it("converts italic to <em>", async () => {
    const { formatMessage } = await import("../lib/markdown");
    const result = formatMessage("*italic* text");
    expect(result).toContain("<em>italic</em>");
  });

  it("converts h1 headers", async () => {
    const { formatMessage } = await import("../lib/markdown");
    const result = formatMessage("# Title");
    expect(result).toContain("<h1");
    expect(result).toContain("Title");
  });

  it("converts h2 headers", async () => {
    const { formatMessage } = await import("../lib/markdown");
    const result = formatMessage("## Subtitle");
    expect(result).toContain("<h2");
    expect(result).toContain("Subtitle");
  });

  it("converts h3 headers", async () => {
    const { formatMessage } = await import("../lib/markdown");
    const result = formatMessage("### Sub-subtitle");
    expect(result).toContain("<h3");
  });

  it("converts unordered lists", async () => {
    const { formatMessage } = await import("../lib/markdown");
    const result = formatMessage("- item one\n- item two");
    expect(result).toContain("<li");
    expect(result).toContain("item one");
    expect(result).toContain("<ul");
  });

  it("converts ordered lists", async () => {
    const { formatMessage } = await import("../lib/markdown");
    const result = formatMessage("1. first\n2. second");
    expect(result).toContain("<li");
    expect(result).toContain("first");
  });

  it("converts line breaks", async () => {
    const { formatMessage } = await import("../lib/markdown");
    const result = formatMessage("line one\nline two");
    expect(result).toContain("<br");
  });

  it("escapes HTML in regular text (XSS prevention)", async () => {
    const { formatMessage } = await import("../lib/markdown");
    const result = formatMessage("<script>alert('xss')</script>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("preserves code blocks", async () => {
    const { formatMessage } = await import("../lib/markdown");
    const result = formatMessage("```\ncode here\n```");
    expect(result).toContain("code here");
  });
});

// ─────────────────────────────────────────────────────────────────────
// renderHighlighted
// ─────────────────────────────────────────────────────────────────────
describe("renderHighlighted", () => {
  it("escapes HTML to prevent XSS", async () => {
    const { renderHighlighted } = await import("../lib/markdown");
    const result = renderHighlighted("<script>alert('xss')</script>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("wraps **words** in mark tags", async () => {
    const { renderHighlighted } = await import("../lib/markdown");
    const result = renderHighlighted("Das **Haus** ist groß");
    expect(result).toContain("<mark");
    expect(result).toContain("Haus");
    expect(result).not.toContain("**");
  });

  it("handles multiple highlighted words", async () => {
    const { renderHighlighted } = await import("../lib/markdown");
    const result = renderHighlighted("**eins** und **zwei**");
    expect(result.match(/<mark/g)?.length).toBe(2);
  });

  it("returns plain text when no highlights", async () => {
    const { renderHighlighted } = await import("../lib/markdown");
    const result = renderHighlighted("just text");
    expect(result).not.toContain("<mark");
    expect(result).toContain("just text");
  });
});

// ─────────────────────────────────────────────────────────────────────
// renderClickable
// ─────────────────────────────────────────────────────────────────────
describe("renderClickable", () => {
  it("adds data-clickable-word attribute", async () => {
    const { renderClickable } = await import("../lib/markdown");
    const result = renderClickable("Das **Haus** ist groß");
    expect(result).toContain('data-clickable-word="Haus"');
  });

  it("adds cursor-pointer class", async () => {
    const { renderClickable } = await import("../lib/markdown");
    const result = renderClickable("**Wort**");
    expect(result).toContain("cursor-pointer");
  });

  it("escapes HTML before processing", async () => {
    const { renderClickable } = await import("../lib/markdown");
    const result = renderClickable("**<b>**");
    expect(result).not.toContain("<b>");
    expect(result).toContain("&lt;b&gt;");
  });
});

// ─────────────────────────────────────────────────────────────────────
// parseAiJson
// ─────────────────────────────────────────────────────────────────────
describe("parseAiJson", () => {
  it("parses valid JSON", async () => {
    const { parseAiJson } = await import("../lib/markdown");
    const result = parseAiJson<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: "test" });
  });

  it("strips markdown code fences", async () => {
    const { parseAiJson } = await import("../lib/markdown");
    const result = parseAiJson<{ a: number }>("```json\n{\"a\": 1}\n```");
    expect(result).toEqual({ a: 1 });
  });

  it("extracts JSON from mixed text", async () => {
    const { parseAiJson } = await import("../lib/markdown");
    const result = parseAiJson<{ x: string }>("Here is the result:\n{\"x\": \"yes\"}\nDone!");
    expect(result).toEqual({ x: "yes" });
  });

  it("returns null for invalid JSON", async () => {
    const { parseAiJson } = await import("../lib/markdown");
    const result = parseAiJson("not json at all");
    expect(result).toBeNull();
  });

  it("parses JSON arrays", async () => {
    const { parseAiJson } = await import("../lib/markdown");
    const result = parseAiJson<number[]>("[1, 2, 3]");
    expect(result).toEqual([1, 2, 3]);
  });

  it("handles empty string", async () => {
    const { parseAiJson } = await import("../lib/markdown");
    const result = parseAiJson("");
    expect(result).toBeNull();
  });
});
