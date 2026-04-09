import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mocks ────────────────────────────────────────────────────────────
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const mockToggleFavorite = vi.fn().mockResolvedValue(true);
const mockGetFavoriteLists = vi.fn().mockResolvedValue([]);
const mockGetWordListMemberships = vi.fn().mockResolvedValue([]);
const mockCreateFavoriteList = vi.fn().mockResolvedValue({ id: 1, name: "Test", language_pair_id: 1, item_count: 0, created_at: "2025-01-01" });
const mockAddToFavoriteList = vi.fn().mockResolvedValue(undefined);
const mockRemoveFromFavoriteList = vi.fn().mockResolvedValue(undefined);

vi.mock("../lib/bridge", () => ({
  toggleFavorite: (...args: unknown[]) => mockToggleFavorite(...args),
  getFavoriteLists: (...args: unknown[]) => mockGetFavoriteLists(...args),
  getWordListMemberships: (...args: unknown[]) => mockGetWordListMemberships(...args),
  createFavoriteList: (...args: unknown[]) => mockCreateFavoriteList(...args),
  addToFavoriteList: (...args: unknown[]) => mockAddToFavoriteList(...args),
  removeFromFavoriteList: (...args: unknown[]) => mockRemoveFromFavoriteList(...args),
}));

import FavoriteButton from "../components/FavoriteButton";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// FavoriteButton
// ─────────────────────────────────────────────────────────────────────
describe("FavoriteButton", () => {
  it("renders a heart button", () => {
    render(
      <FavoriteButton wordId={1} isFavorite={false} onToggle={() => {}} />,
    );
    const button = screen.getByTitle("favorites.addToList");
    expect(button).toBeInTheDocument();
  });

  it("shows filled heart when isFavorite is true", () => {
    const { container } = render(
      <FavoriteButton wordId={1} isFavorite={true} onToggle={() => {}} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    // The button should have the rose/red styling
    const button = screen.getByTitle("favorites.remove");
    expect(button.className).toContain("text-rose-500");
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(
      <FavoriteButton wordId={1} isFavorite={false} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByTitle("favorites.addToList"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls bridge.toggleFavorite when clicked", () => {
    render(
      <FavoriteButton wordId={42} isFavorite={false} onToggle={() => {}} />,
    );
    fireEvent.click(screen.getByTitle("favorites.addToList"));
    expect(mockToggleFavorite).toHaveBeenCalledWith(42);
  });

  it("does not show ListPopover when pairId is not provided", () => {
    render(
      <FavoriteButton wordId={1} isFavorite={true} onToggle={() => {}} />,
    );
    // No list button should be present
    expect(screen.queryByText("favorites.list")).not.toBeInTheDocument();
  });

  it("shows ListPopover button when pairId is provided and favorited", async () => {
    mockGetFavoriteLists.mockResolvedValue([
      { id: 1, name: "Vocab", language_pair_id: 1, item_count: 5, created_at: "2025-01-01" },
    ]);
    mockGetWordListMemberships.mockResolvedValue([]);

    render(
      <FavoriteButton wordId={1} isFavorite={true} onToggle={() => {}} pairId={1} />,
    );

    // The ListPopover's trigger button should be visible
    expect(screen.getByText("favorites.list")).toBeInTheDocument();
  });

  it("does not show ListPopover button when not favorited even with pairId", () => {
    render(
      <FavoriteButton wordId={1} isFavorite={false} onToggle={() => {}} pairId={1} />,
    );
    expect(screen.queryByText("favorites.list")).not.toBeInTheDocument();
  });

  it("opens list popover after favoriting when pairId is provided", async () => {
    mockGetFavoriteLists.mockResolvedValue([
      { id: 1, name: "Animaux", language_pair_id: 1, item_count: 3, created_at: "2025-01-01" },
    ]);
    mockGetWordListMemberships.mockResolvedValue([]);

    // Start as not favorited, then the parent will re-render with isFavorite=true
    const { rerender } = render(
      <FavoriteButton wordId={1} isFavorite={false} onToggle={() => {}} pairId={1} />,
    );

    // Click to favorite
    fireEvent.click(screen.getByTitle("favorites.addToList"));

    // Re-render as favorited (simulating parent state update)
    rerender(
      <FavoriteButton wordId={1} isFavorite={true} onToggle={() => {}} pairId={1} />,
    );

    // Lists should be fetched
    await waitFor(() => {
      expect(mockGetFavoriteLists).toHaveBeenCalledWith(1);
    });
  });
});
