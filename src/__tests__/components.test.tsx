import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// Placeholder so vitest doesn't error on a file with zero suites.
// Real component tests can be added here when needed.
describe("components", () => {
  it("smoke test passes", () => {
    expect(true).toBe(true);
  });
});
