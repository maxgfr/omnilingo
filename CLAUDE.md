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
