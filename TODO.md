# Omnilingo — TODO

## Done

- [x] Tauri v2 + React 19 + TypeScript 5.8 + Tailwind CSS v4 + Vite 7
- [x] i18n: react-i18next, en/fr synced (358 keys), AI translation to any language
- [x] Onboarding: native lang → target lang → level → import dict or generate AI
- [x] SRS flashcards SM-2 (4 buttons + reverse mode + spelling mode)
- [x] Grammar lessons with exercises (QCM, fill-blank, true/false)
- [x] Conjugation practice (random, by tense, by verb)
- [x] Dictionary: FTS5 search, favorites, custom words, filters
- [x] Quiz mode (mixed vocab + conjugation, MCQ + text input)
- [x] Stats page (overview, 30-day activity chart, frequent errors)
- [x] Word of the Day, daily goal, 8 achievements
- [x] AI Chat: multi-provider (Anthropic, OpenAI, Gemini, Mistral, GLM, Claude CLI, Ollama)
- [x] AI presets (Fast/Balanced/Best/Free/Offline), model dropdown, test connection
- [x] TTS: Web Speech API with voice preloading + audio_enabled setting
- [x] STT: Whisper (whisper-rs 0.16, 16kHz resampling, MicButton component)
- [x] Dark mode, auto-update, Cmd+K palette, session timer, view transitions
- [x] Import dictionaries: CSV/TSV/JSON (Wiktionary, FreeDict, custom)
- [x] Export/import progression as JSON
- [x] Settings cleanup: delete words, delete models, clear translations, clear cache, reset progress
- [x] CI/CD: macOS (arm64 + x64) + Windows via GitHub Actions
- [x] Dictionary-first: no static data, user imports their own content
- [x] All English: Rust backend, frontend, i18n default, window title

---

## UX Improvements

### Navigation & Flow
- [ ] **Empty state CTA** — When dictionary is empty, show a prominent card on Dashboard: "Import a dictionary to get started" with file picker + AI generate buttons
- [ ] **Streak celebration** — Confetti animation at 7, 30, 100 day milestones
- [ ] **Session summary** — After completing a Review/Learn/Quiz session, show a rich summary card with stats, time spent, and "Share" button
- [ ] **Breadcrumb navigation** — In Grammar detail view, show "Grammar > A1 > Topic Name"

### Learning
- [ ] **AI-generated exercises** — Button in Grammar/Conjugation: "Generate 5 exercises with AI" based on the current topic
- [ ] **AI vocabulary generator** — In Dictionary: "Generate 50 words for [theme]" (food, travel, work) using AI
- [ ] **Conversation mode** — AI plays a role (waiter, colleague) and evaluates responses
- [ ] **Leitner box visualization** — Show SRS bucket distribution (new → learning → mastered)
- [ ] **Spaced grammar review** — Grammar topics with SRS-like scheduling
- [ ] **Contextual sentences** — Show 2-3 example sentences per word during review

### Settings & Data
- [ ] **Study schedule** — Configure study days (Mon-Sun) and daily reminder time
- [ ] **SRS customization** — Let advanced users tweak SM-2 parameters (initial intervals, ease bounds)
- [ ] **Level auto-promotion** — Suggest upgrading CEFR level when 80%+ words mastered
- [ ] **Focus areas** — Prioritize vocabulary vs grammar vs conjugation

### Polish
- [ ] **Markdown in chat** — Render headers, lists, code blocks in AI responses
- [ ] **Chat persistence** — Save chat history to SQLite instead of sessionStorage
- [ ] **Pronunciation score** — Levenshtein distance between STT and expected word
- [ ] **Themes** — Custom accent colors (amber, blue, green, purple)
- [ ] **Conjugation speed drill** — 60-second challenge

---

## Technical
- [ ] **Piper TTS** — Neural offline voices (optional feature flag)
- [ ] **React.lazy + Suspense** — Lazy load views for faster initial load
- [ ] **Offline fonts** — Bundle Inter font, remove Google Fonts CDN
- [ ] **E2E tests** — Tauri MCP automated UI tests
- [ ] **Ollama integration** — Test and document local LLM setup
