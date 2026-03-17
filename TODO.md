# Omnilingo — TODO

## Legend
- `[ ]` To do
- `[x]` Done
- `[~]` Partially done

---

## Done

- [x] React + TypeScript migration (vanilla JS → React 19, TS 5.8, Vite 7)
- [x] Tailwind CSS v4 (no CDN, Vite plugin)
- [x] i18n with react-i18next (en/fr + AI translation to any language)
- [x] Onboarding wizard (native lang → target lang → level → auto-import)
- [x] SRS flashcards with SM-2 algorithm (4 buttons)
- [x] Grammar lessons with exercises (QCM, fill-blank, true/false)
- [x] Conjugation practice (3 modes: random, by tense, by verb)
- [x] Dictionary browser with FTS5 search + filters
- [x] AI Chat with multi-provider support (Anthropic, OpenAI, Gemini, Mistral, GLM, Claude CLI)
- [x] Quiz mode (mixed vocab + grammar + conjugation)
- [x] Statistics page (overview, activity chart, frequent errors)
- [x] Word of the Day on dashboard
- [x] TTS via Web Speech API (with voice preloading)
- [x] STT via Whisper (backend + MicButton component)
- [x] Dark mode
- [x] Auto-update system (tauri-plugin-updater)
- [x] Favorites backend (toggle/get/is_favorite)
- [x] Error logging to SQLite errors table
- [x] Custom word addition backend
- [x] CI: tsc + Clippy on macOS/Windows
- [x] Release: macOS (arm64 + x64) + Windows via GitHub Actions
- [x] Reset progress button in Settings
- [x] Clear cache button in Settings

---

## UX — High Priority

- [ ] **Favorites UI in Dictionary** — Heart icon on each word card to toggle favorite, filter to show only favorites
- [ ] **Favorites view** — Dedicated page listing all favorited words with review/remove actions
- [ ] **Add custom word UI** — Button in Dictionary to open a form (source word, target word, gender, level, category) using `addCustomWord` bridge
- [ ] **Spelling practice mode** — Type the word instead of just recognizing it, compare with correct answer, show diff
- [ ] **Reverse flashcards toggle** — In Review settings, option to flip cards (show target → guess source)
- [ ] **Daily goal indicator** — On Dashboard, show "3/10 words learned today" progress bar based on `words_per_day` setting
- [ ] **Streak celebration** — Confetti/animation when hitting milestones (7 days, 30 days, 100 days)
- [ ] **Session timer** — Show elapsed time during Review/Learn/Quiz sessions, log time_spent_seconds to daily_stats

---

## UX — Medium Priority

- [ ] **Command palette (Cmd+K)** — Quick search: find a word, navigate to a view, or start an action
- [ ] **Global keyboard shortcuts** — Ctrl+1..9 to navigate views, Ctrl+R to refresh data
- [ ] **Leitner box visualization** — Visual SRS buckets showing how many cards are at each stage (new → learning → mastered)
- [ ] **Achievements/badges system** — Compute from existing data: "First word", "100 words", "7-day streak", "Perfect quiz", "Grammar master". Show in Dashboard or dedicated page.
- [ ] **Export/Import progression** — Export SQLite data as JSON backup, import from file. Useful for device migration.
- [ ] **Onboarding: download dictionary** — When user picks a pair without built-in data (e.g. EN→ES), offer to download a FreeDict dictionary during onboarding
- [ ] **Animated transitions between steps** — Slide/fade transitions within views (e.g. quiz questions, grammar exercises)
- [ ] **Search in grammar topics** — Filter grammar topics by keyword
- [ ] **Error-targeted exercises** — Use `getFrequentErrors` to generate AI exercises focused on the user's weak points

---

## UX — Nice to Have

- [ ] **Themes** — Custom accent colors (amber, blue, green, purple) beyond dark/light
- [ ] **Drag & drop word lists** — Reorder favorites or custom lists
- [ ] **Pronunciation score** — Show edit distance between Whisper transcript and expected word (not just match/no-match)
- [ ] **Chat history persistence** — Save chat history to SQLite instead of sessionStorage
- [ ] **Markdown rendering in chat** — Proper markdown (headers, lists, code blocks) in AI responses
- [ ] **Grammar exercise generation via AI** — Generate new exercises from grammar explanations using the AI provider
- [ ] **Conjugation drill timer** — Speed challenge: conjugate as many verbs as possible in 60 seconds
- [ ] **Progress sharing** — Export stats as an image for sharing

---

## Content

- [ ] **More DE→FR data** — Expand from 500 to 1500+ words, 200+ verbs
- [ ] **FR→EN / EN→FR pairs** — Create built-in data for French-English learners
- [ ] **B2+ grammar topics** — Add advanced grammar (Konjunktiv I, Passiv, Relativsätze)
- [ ] **Tatoeba sentences** — Import example sentences for context-based learning
- [ ] **Thematic categories** — Add themes: travel, work, health, food, sports, etc.
- [ ] **StarDict parser** — Parse .ifo/.idx/.dict binary format for FreeDict downloads (currently only downloads the archive)

---

## Technical

- [ ] **Piper TTS** — Neural offline TTS for better voice quality (optional feature flag)
- [ ] **Tests E2E** — Use Tauri MCP for automated UI tests
- [ ] **Tests unitaires Rust** — Tests for SM-2, import, StarDict parser
- [ ] **Offline assets** — Bundle Inter font, remove Google Fonts CDN dependency
- [ ] **PWA manifest** — Service worker for full offline support
- [ ] **Custom app icons** — Design and generate Omnilingo-branded icons
- [ ] **Performance** — Lazy load views with React.lazy + Suspense
- [ ] **Accessibility** — Full ARIA labels, focus management, screen reader support
- [ ] **localStorage migration** — Import v1 localStorage data to SQLite on first launch
