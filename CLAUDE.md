# Omnilingo v2

## Project

Desktop **Tauri v2** app (Rust + React + TypeScript) for language learning.
UI in **French**. Multi-language: DE-FR, EN-FR, etc.

## Architecture

```
src/                     React + TypeScript frontend
  ├── App.tsx            Routes (HashRouter)
  ├── main.tsx           Entry point
  ├── index.css          Tailwind CSS v4 + custom
  ├── types/index.ts     TypeScript interfaces
  ├── lib/bridge.ts      Tauri IPC (invoke)
  ├── lib/speech.ts      TTS Web Speech API
  ├── store/AppContext.tsx  Global React Context
  ├── components/        Layout, Flashcard, ProgressBar, Exercise
  └── views/             Dashboard, Learn, Review, Grammar,
                         Conjugation, Dictionary, Chat, Settings

src-tauri/               Rust backend
  ├── src/lib.rs         Tauri setup + commands
  ├── src/db.rs          SQLite + migrations
  ├── src/commands/      ai, srs, dictionary, grammar,
  │                      conjugation, import, memory,
  │                      settings, speech, download
  └── migrations/        SQL schemas

data/                    Static JSON (initial import)
memory/                  Markdown progression files
```

## Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 7, Tailwind CSS v4, lucide-react, react-router-dom
- **Backend**: Rust, Tauri v2, SQLite (rusqlite), reqwest, chrono
- **Package manager**: bun
- **TTS**: Web Speech API (browser)
- **STT**: whisper-rs (optional, feature flag `stt`)

## Commands

```bash
bun install                        # Install frontend deps
bun run dev                        # Vite dev server only
bun run build                      # Build frontend (tsc + vite)
cargo tauri dev                    # Full app in dev
cargo tauri build                  # Release build
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings  # Rust lint
```

## IPC

The bridge (`src/lib/bridge.ts`) exposes typed functions that call Rust commands via `invoke()` from `@tauri-apps/api/core`. All Rust commands are in `src-tauri/src/commands/`.

## SRS

SM-2 algorithm in Rust (`commands/srs.rs`). 4 buttons: Forgot (0), Hard (2), Good (3), Easy (5). Data in SQLite, auto-sync to `memory/vocabulary.md`.

## AI Providers

Anthropic, OpenAI, Gemini, Mistral, GLM, Claude CLI (local subprocess, no API key needed).

## CI/CD

- `build.yml`: Typecheck (tsc) + Vite build on ubuntu, then Clippy on macOS + Windows — on push/PR to main
- `release.yml`: Typecheck gate, then build macOS (arm64 + x64) + Windows (x64) with tauri-action, GitHub Release + auto-update JSON — on tag `v*`

### GitHub Secrets (optional)

| Secret | Usage |
|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Sign updater artifacts |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password |
| `APPLE_CERTIFICATE` | Base64 .p12 certificate (macOS signing) |
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
