# Omnilingo — TODO

## Legend
- `[ ]` To do
- `[x]` Done

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
- [x] AI Chat with multi-provider support
- [x] Quiz mode (mixed vocab + grammar + conjugation)
- [x] Statistics page (overview, activity chart, frequent errors)
- [x] Word of the Day on dashboard
- [x] TTS via Web Speech API (with voice preloading)
- [x] STT via Whisper (backend + MicButton component)
- [x] Dark mode
- [x] Auto-update system (tauri-plugin-updater)
- [x] CI: tsc + Clippy on macOS/Windows
- [x] Release: macOS (arm64 + x64) + Windows via GitHub Actions
- [x] Reset progress + Clear cache in Settings
- [x] Favorites (heart toggle in Dictionary, filter favorites only)
- [x] Add custom word UI (form in Dictionary)
- [x] Reverse flashcards toggle (in Review)
- [x] Spelling practice mode (type the word in Review)
- [x] Daily goal indicator (Dashboard progress bar)
- [x] Achievements/badges (8 achievements on Dashboard)
- [x] Command palette (Cmd+K)
- [x] Session timer (Review + Learn)
- [x] Search in grammar topics
- [x] Error logging to SQLite errors table
- [x] View transition animations (fadeIn)
- [x] Audio enabled/disabled setting respected

---

## UX — To Do

- [ ] **Streak celebration** — Confetti/animation when hitting milestones (7 days, 30 days, 100 days)
- [ ] **Leitner box visualization** — Visual SRS buckets showing how many cards are at each stage (new → learning → mastered)
- [ ] **Export/Import progression** — Export SQLite data as JSON backup, import from file
- [ ] **Onboarding: download dictionary** — When user picks a pair without built-in data, offer to download a FreeDict dictionary
- [ ] **Error-targeted exercises** — Use `getFrequentErrors` to generate AI exercises focused on weak points
- [ ] **Pronunciation score** — Show edit distance between Whisper transcript and expected word
- [ ] **Chat history persistence** — Save chat history to SQLite instead of sessionStorage
- [ ] **Markdown rendering in chat** — Proper markdown (headers, lists, code blocks) in AI responses
- [ ] **Grammar exercise generation via AI** — Generate new exercises from grammar explanations
- [ ] **Conjugation drill timer** — Speed challenge: conjugate as many verbs as possible in 60 seconds
- [ ] **Progress sharing** — Export stats as an image for sharing
- [ ] **Themes** — Custom accent colors beyond dark/light

---

## Content

- [ ] **More DE→FR data** — Expand from 500 to 1500+ words, 200+ verbs
- [ ] **FR→EN / EN→FR pairs** — Create built-in data for French-English learners
- [ ] **B2+ grammar topics** — Add advanced grammar (Konjunktiv I, Passiv, Relativsätze)
- [ ] **Tatoeba sentences** — Import example sentences for context-based learning
- [ ] **StarDict parser** — Parse .ifo/.idx/.dict binary format for FreeDict downloads

---

## Technical

- [ ] **Piper TTS** — Neural offline TTS for better voice quality (optional feature flag)
- [ ] **Tests E2E** — Use Tauri MCP for automated UI tests
- [ ] **Tests unitaires Rust** — Tests for SM-2, import, StarDict parser
- [ ] **Offline assets** — Bundle Inter font, remove Google Fonts CDN dependency
- [ ] **Custom app icons** — Design and generate Omnilingo-branded icons
- [ ] **Performance** — Lazy load views with React.lazy + Suspense
- [ ] **Accessibility** — Full ARIA labels, focus management, screen reader support
