import { vi, beforeEach } from "vitest";

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
