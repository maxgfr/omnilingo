# Omnilingo

AI-first desktop language learning. Pick a language pair, download a [FreeDict](https://freedict.org/) pack, and let the model generate grammar lessons, verb conjugations and vocabulary explanations on demand.

Built with [Tauri v2](https://tauri.app), React 19 and TypeScript.

## Features

- **Dictionary** — search across downloaded FreeDict packs with accent-insensitive lookup, and an "Explore with AI" button that produces a bilingual explanation (translation, grammar, examples, usage notes, synonyms/antonyms) in your native language.
- **Grammar** — AI-generated lessons on any topic, with key points, bilingual examples and three exercise types (multiple choice, fill-in-the-blank, true/false). Save lessons to the local SQLite database for spaced-repetition review.
- **Conjugation** — AI-generated conjugation tables for any verb, with a typing-practice mode that checks your answers form by form.
- **Conversation** — scenario-based AI role-play (5 presets, 5 built-in scenarios, custom scenarios you can write yourself), with full session history.
- **AI writing tools** — Rephrase, Corrector, Synonyms and Text Analysis (sentence mining), each as a focused single-purpose view.
- **FreeDict catalog** — browse and download from 305+ language pairs directly inside the app.
- **Command palette** — fast navigation with `Cmd/Ctrl + K`.
- **Local-first** — everything is stored in a local SQLite database. AI calls go directly from your machine to the provider you configure; there is no Omnilingo backend.
- **Multi-pair** — add and switch between language pairs from Settings.
- **Text-to-speech** — pronunciation playback in Dictionary via the browser Web Speech API.
- **Dark mode** — full dark theme with system / light / dark toggle.

## Supported AI providers

| Type | Providers |
|------|-----------|
| Cloud APIs | Anthropic, OpenAI, Google Gemini, Mistral, GLM (Z.ai), any OpenAI-compatible custom endpoint |
| Local CLIs | Claude Code, Codex CLI |
| Local servers | Ollama, LM Studio |

Local providers (CLIs and `localhost` servers) need no API key.

## Prerequisites

- [Rust](https://rustup.rs/) ≥ 1.77
- [Bun](https://bun.sh/) ≥ 1.0
- Tauri system dependencies — [see docs](https://v2.tauri.app/start/prerequisites/)

## Setup

```bash
git clone https://github.com/maxgfr/omnilingo.git
cd omnilingo
bun install
```

## Development

```bash
# Run the full app in dev mode (hot reload frontend + backend)
cargo tauri dev

# Frontend only (Vite dev server)
bun run dev

# Frontend production build
bun run build

# TypeScript typecheck
./node_modules/.bin/tsc --noEmit

# Frontend tests
bun vitest run

# Rust lint and tests
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## Build

```bash
cargo tauri build
```

Artifacts are produced in `src-tauri/target/release/bundle/`:

- **macOS** — `.dmg`, `.app`
- **Windows** — `.msi`, `.exe`

### macOS — first launch

The published `.dmg` is not Apple-notarized, so macOS marks it with a quarantine attribute and refuses to launch it ("Omnilingo is damaged and can't be opened" or "from an unidentified developer"). After dragging Omnilingo into `/Applications`, clear the quarantine flag once:

```bash
xattr -cr /Applications/Omnilingo.app
```

Then open the app normally. You only need to run this command after a fresh install or update.

## Project structure

```
omnilingo/
├── src/                       React + TypeScript frontend
│   ├── views/                 Dictionary, Grammar, Conjugation, Conversation,
│   │                          Rephrase, Corrector, Synonyms, TextAnalysis, Settings
│   ├── components/            Layout, CommandPalette, Exercise,
│   │                          LanguagePackDownloader, tools/, ui/
│   ├── store/                 useAppStore.ts (Zustand) + AppContext.tsx (facade)
│   ├── lib/                   bridge.ts, wordUtils, ai-cache, markdown,
│   │                          useExampleTranslations, useFeaturePair, ...
│   ├── i18n/                  i18next + locales/en.json
│   └── types/                 Zod schemas + TypeScript interfaces
├── src-tauri/                 Rust backend
│   ├── src/commands/          ai, chat, conjugation, conversation, dictionary,
│   │                          download, favorites, grammar, memory, settings
│   ├── src/db.rs              SQLite (WAL, unaccent, migrations runner)
│   └── migrations/            001_initial_schema.sql … 008_drop_srs.sql
├── data/                      dictionary-sources.json (FreeDict catalog)
├── memory/                    Markdown progression files
└── .github/workflows/         build.yml, release.yml
```

## Tech stack

- **Frontend** — React 19, TypeScript 5.8, Vite 7, Tailwind CSS v4, Zustand 5, react-router-dom 7, react-i18next, lucide-react, fuse.js, zod, vitest (jsdom)
- **Backend** — Rust, Tauri v2, rusqlite 0.31 (bundled, with custom functions), reqwest 0.12 (rustls-tls), tokio, chrono, xz2 / tar / flate2 / bzip2 (FreeDict pack extraction), tauri-plugin-log / -updater / -process. Optional `mcp` feature gates `tauri-plugin-mcp-bridge` for E2E testing.
- **Package manager** — bun

## CI/CD

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `build.yml` | Push / PR on `main` | Commitlint (PRs), TypeScript typecheck, vitest, Vite build, Clippy + cargo test on macOS and Windows, cargo audit. Concurrent runs for the same ref are auto-cancelled. |
| `release.yml` | Tag `v*` | Builds macOS (arm64 + x64) and Windows (x64) via tauri-action, creates a GitHub Release with the bundled artifacts and the auto-update `latest.json` |

## Releasing

```bash
git tag -a v2.0.0 -m "v2.0.0"
git push origin v2.0.0
```

The `release.yml` workflow then:

1. Builds the app for macOS Apple Silicon, macOS Intel and Windows
2. Creates a GitHub Release with `.dmg` and `.msi` / `.exe` artifacts
3. Generates `latest.json` for the in-app updater

### GitHub Secrets (optional)

For signing and notarization:

| Secret | Description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Updater artifact signing key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password |
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password |
| `APPLE_SIGNING_IDENTITY` | macOS signing identity |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Apple notarization |

## License

[MIT](LICENSE)
