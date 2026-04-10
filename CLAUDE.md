# Omnilingo

## Project

Desktop **Tauri v2** app (Rust + React + TypeScript) for AI-first language learning. The user downloads a [FreeDict](https://freedict.org/) pack for their language pair, and the AI generates grammar lessons, verb conjugations and vocabulary explanations on demand. UI is in **English** with i18n via `react-i18next`. Multi-pair architecture (DE-FR, EN-FR, FR-DE, …).

## Architecture

```
src/
  App.tsx                    Routes (HashRouter)
  main.tsx
  index.css                  Tailwind v4
  types/index.ts             Zod schemas + TypeScript interfaces
  i18n/                      i18next + locales/en.json
  lib/
    bridge.ts                Typed invoke() wrappers
    wordUtils.ts             FreeDict parsing helpers
    ai-cache.ts              AI response caching + recent searches
    markdown.ts              Markdown rendering + clickable words
    exampleData.ts           English-base example previews
    exampleTranslations.ts   AI translation cache (per pair)
    useExampleTranslations.ts
    useFeaturePair.ts        Active pair selector hook
    useStreamingResponse.ts  Streaming AI text hook
  store/
    useAppStore.ts           Zustand — SOURCE OF TRUTH
    AppContext.tsx           Thin Context facade over useAppStore;
                             also calls reloadSettings() on mount
                             and applies the dark-mode class on <html>
  components/
    Layout.tsx, CommandPalette.tsx, DictionaryPairSelector.tsx,
    Exercise.tsx, LanguagePackDownloader.tsx
    tools/   CorrectorTool, RephraseTool, SynonymsTool, SentenceMiningTool
    ui/      PageHeader, SearchInput, Spinner, ExamplePreview, RecentSearches
  views/
    Dictionary, Grammar, Conjugation, Conversation,
    Rephrase, Corrector, Synonyms, TextAnalysis, Settings

src-tauri/
  src/lib.rs                 Tauri setup, command registration
  src/db.rs                  init_database(base_dir): WAL + foreign_keys
                             + unaccent() + run_migrations()
  src/commands/
    ai.rs            Multi-provider router (cloud APIs + local CLIs/servers)
    chat.rs          Chat history persistence
    conjugation.rs   save_verb (only)
    conversation.rs  Role-play scenarios + sessions + title updates
    dictionary.rs    FreeDict accent-insensitive search
    download.rs      FreeDict catalog + pack download/extract
    favorites.rs     Favorites + custom lists (Rust side only — no UI today)
    grammar.rs       Grammar lesson persistence + SRS scheduling for review
    memory.rs        memory/*.md sync
    settings.rs      User settings + language pairs
    mod.rs           Registers all the above
  migrations/
    001_initial_schema.sql
    002_ai_providers.sql
    003_favorites_and_stats.sql
    004_chat_history.sql
    005_simplification.sql
    006_custom_ai_url.sql
    007_favorite_lists.sql
    008_drop_srs.sql

data/                        dictionary-sources.json (FreeDict catalog)
memory/                      Markdown progression files
```

## State management

`useAppStore.ts` (Zustand) is the single source of truth for everything stateful: `settings`, `languagePairs`, `activePairId`, AI provider config (`aiProvider`, `aiApiKey`, `aiModel`, `aiCustomUrl`), per-view caches (`dictionaryCache`, `grammarCache`, `conjugationCache`, `conversationCache`) and per-tool input/result caches.

`AppContext.tsx` is a thin React Context facade that re-exposes a subset (`settings`, `languagePairs`, `loading`, `reloadSettings`, `updateSetting`) for components that prefer the context API. It also calls `reloadSettings()` once on mount and applies the dark-mode class to `<html>`. It is **not** a parallel store — there is only one source of truth.

## Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 7, Tailwind CSS v4, Zustand 5, react-router-dom 7, react-i18next, lucide-react, fuse.js, zod, vitest (jsdom)
- **Backend**: Rust 2021 (MSRV 1.77.2), Tauri v2, rusqlite 0.31 (`bundled` + `functions`), reqwest 0.12 (`rustls-tls`), tokio, chrono, xz2 / tar / flate2 / bzip2 (FreeDict pack extraction), tauri-plugin-log, tauri-plugin-updater, tauri-plugin-process. Optional `mcp` feature gates `tauri-plugin-mcp-bridge` for E2E testing.
- **Package manager**: bun
- **TTS**: browser Web Speech API (used in Dictionary, no backend dependency)

## Commands

```bash
bun install                                                       # Install frontend deps
bun run dev                                                       # Vite dev server only
bun run build                                                     # tsc + vite build
bun vitest run                                                    # Frontend unit tests
./node_modules/.bin/tsc --noEmit                                  # Standalone typecheck
cargo tauri dev                                                   # Full app in dev
cargo tauri build                                                 # Release build
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings  # Rust lint
cargo test --manifest-path src-tauri/Cargo.toml                   # Rust tests
```

## IPC

`src/lib/bridge.ts` is the single typed façade over `@tauri-apps/api/core::invoke`. Every Rust command in `src-tauri/src/commands/*.rs` has a matching wrapper there; views and hooks **never** call `invoke` directly. When adding a command:

1. Add the function to the relevant `commands/*.rs`
2. Register the module in `commands/mod.rs` if it's new
3. Register the command in `lib.rs` under `tauri::generate_handler![…]`
4. Add the typed wrapper in `lib/bridge.ts`

## AI Providers

Routed in `commands/ai.rs`:

- **Cloud APIs**: `anthropic`, `openai`, `gemini`, `mistral`, `glm`, `custom` (any OpenAI-compatible endpoint URL stored in DB)
- **Local CLIs**: `claude-code`, `codex` (spawned subprocesses, no API key)
- **Local servers**: `ollama` (`http://localhost:11434`), `lmstudio` (`http://localhost:1234`)

The router handles non-streaming `ask_ai` and multi-turn `ask_ai_conversation` calls. 429 responses get exponential-backoff retries.

## Database

`db.rs::init_database(base_dir)` opens `{base_dir}/omnilingo.db`, enables WAL mode and `foreign_keys`, registers a custom `unaccent()` SQL function for accent-insensitive dictionary search, then runs the 8 ordered migrations in `migrations/`. Schema versioning lives in a `schema_version` table; migrations are applied incrementally and idempotently. Migration `008_drop_srs.sql` dropped the `srs_cards` table (the old vocabulary flashcard SRS); grammar review scheduling lives in a separate `grammar_srs` table that is still in use.

## CI/CD

- **`build.yml`** (push / PR on `main`): commitlint (PRs only), frontend (typecheck + vitest + Vite build) on Ubuntu, then Clippy + `cargo test` on macOS and Windows in parallel, plus `cargo audit` for dependency vulnerabilities.
- **`release.yml`** (tag `v*`): builds macOS (arm64 + x64) and Windows (x64) via tauri-action, creates a GitHub Release with bundled artifacts and the auto-update `latest.json`.

### GitHub Secrets (optional)

| Secret | Usage |
|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Sign updater artifacts |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password |
| `APPLE_CERTIFICATE` | Base64 `.p12` certificate (macOS signing) |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password |
| `APPLE_SIGNING_IDENTITY` | Signing identity |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | macOS notarization |

## Process

### Workflow Orchestration

1. **Plan Node Default**: Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions). If something goes sideways, STOP and re-plan immediately — don't keep pushing. Use plan mode for verification steps, not just building. Write detailed specs upfront to reduce ambiguity.
2. **Subagent Strategy**: Use subagents liberally to keep main context window clean. Offload research, exploration, and parallel analysis to subagents. For complex problems, throw more compute at it via subagents. One tack per subagent for focused execution.
3. **Self-Improvement Loop**: After ANY correction from the user: update `tasks/lessons.md` with the pattern. Write rules for yourself that prevent the same mistake. Ruthlessly iterate on these lessons until mistake rate drops. Review lessons at session start for relevant project.
4. **Verification Before Done**: Never mark a task complete without proving it works. Diff behavior between main and your changes when relevant. Ask yourself: "Would a staff engineer approve this?" Run tests, check logs, demonstrate correctness.
5. **Demand Elegance (Balanced)**: For non-trivial changes: pause and ask "is there a more elegant way?" If a fix feels hacky: "Knowing everything I know now, implement the elegant solution." Skip this for simple, obvious fixes — don't over-engineer. Challenge your own work before presenting it.
6. **Autonomous Bug Fixing**: When given a bug report: just fix it. Don't ask for hand-holding. Point at logs, errors, failing tests — then resolve them. Zero context switching required from the user. Go fix failing CI tests without being told how.

### Task Management

- **Plan First**: Write plan to `tasks/todo.md` with checkable items
- **Verify Plan**: Check in before starting implementation
- **Track Progress**: Mark items complete as you go
- **Explain Changes**: High-level summary at each step
- **Document Results**: Add review section to `tasks/todo.md`
- **Capture Lessons**: Update `tasks/lessons.md` after corrections

### Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
