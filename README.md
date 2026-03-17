# Omnilingo

Desktop language learning app built with [Tauri v2](https://tauri.app), React and TypeScript.

## Features

- **SRS Flashcards** — SM-2 spaced repetition algorithm (Forgot / Hard / Good / Easy)
- **Dictionary** — 500+ built-in DE-FR words, search, level and category filters
- **Grammar** — 36 lessons (A1-B1) with interactive exercises (MCQ, fill-in-the-blank, true/false)
- **Conjugation** — 100+ German verbs, 6 tenses, 3 practice modes
- **AI Chat** — Multi-provider language tutor (Anthropic, OpenAI, Gemini, Mistral, GLM, Claude CLI)
- **FreeDict Dictionaries** — 305 downloadable language pairs catalog
- **Speech-to-Text** — Voice recognition via Whisper (optional)
- **Text-to-Speech** — Speech synthesis via Web Speech API
- **Dark mode** — Full dark theme support
- **Multi-language** — Multi-pair architecture (DE-FR by default, extensible)

## Prerequisites

- [Rust](https://rustup.rs/) (>= 1.77)
- [Bun](https://bun.sh/) (>= 1.0)
- Tauri system dependencies ([see docs](https://v2.tauri.app/start/prerequisites/))

## Setup

```bash
git clone https://github.com/maxgfr/omnilingo.git
cd omnilingo
bun install
```

## Development

```bash
# Launch the app in dev mode (hot reload frontend + backend)
cargo tauri dev

# Build frontend only
bun run build

# Typecheck
./node_modules/.bin/tsc --noEmit

# Lint Rust
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

## Release build

```bash
cargo tauri build
```

Artifacts are generated in `src-tauri/target/release/bundle/`:
- **macOS**: `.dmg`, `.app`
- **Windows**: `.msi`, `.exe`

## Project structure

```
omnilingo/
├── src/                    React + TypeScript frontend
│   ├── components/         Reusable components
│   ├── views/              Pages (Dashboard, Learn, Review, ...)
│   ├── store/              React Context (global state)
│   ├── lib/                IPC bridge + utilities
│   └── types/              TypeScript interfaces
├── src-tauri/              Rust backend
│   ├── src/commands/       IPC commands
│   └── migrations/         SQL schemas
├── data/                   Static data (dictionary, grammar, verbs)
├── memory/                 Markdown progression files
└── .github/workflows/      CI/CD (build + release)
```

## CI/CD

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `build.yml` | Push/PR on `main` | TypeScript typecheck + Vite build, then Clippy on macOS and Windows |
| `release.yml` | Tag `v*` | Build macOS (arm64 + x64) + Windows (x64), GitHub Release with auto-update |

### Creating a release

```bash
git tag -a v2.0.0 -m "v2.0.0"
git push origin v2.0.0
```

The `release.yml` workflow will:
1. Run TypeScript typecheck
2. Build the app for macOS Apple Silicon, macOS Intel and Windows
3. Create a GitHub Release with `.dmg` and `.msi`/`.exe` artifacts
4. Generate `latest.json` for auto-update

### GitHub Secrets (optional)

For signing and notarization:

| Secret | Description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Updater artifact signing key |
| `APPLE_CERTIFICATE` | Base64-encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password |
| `APPLE_SIGNING_IDENTITY` | macOS signing identity |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Apple notarization |

## License

[MIT](LICENSE)
