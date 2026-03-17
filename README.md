# Omnilingo

**Desktop language learning app with spaced repetition and AI tutoring.**

Built with [Tauri v2](https://tauri.app) (Rust + vanilla JS). Offline-first, multi-language, multi-AI-provider.

![Tauri](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)
![Rust](https://img.shields.io/badge/Rust-2021-orange?logo=rust)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Spaced Repetition (SM-2)** — Learn vocabulary with scientifically proven intervals
- **305+ downloadable dictionaries** — FreeDict catalog, StarDict format
- **Grammar lessons** — 36 topics (A1/A2/B1) with exercises
- **Verb conjugation** — 100+ verbs, 6 tenses, interactive practice
- **AI chat tutor** — 6 providers: Anthropic, OpenAI/Codex, Gemini, Mistral, GLM, Claude CLI
- **Speech-to-text** — Whisper (optional, offline)
- **Text-to-speech** — Native Web Speech API
- **Multi-language** — DE↔FR built-in, download any pair from FreeDict
- **Offline-first** — Everything works without internet (except AI chat)
- **Auto-update** — Built-in updater checks for new versions

## Screenshots

> Coming soon

## Quick Start

```bash
# Clone
git clone https://github.com/maxgfr/omnilingo.git
cd omnilingo

# Run (requires Rust + Cargo)
cargo tauri dev

# Build release
cargo tauri build

# With speech-to-text (compiles whisper.cpp, slower first build)
cargo tauri dev --features stt
```

### Prerequisites

- [Rust](https://rustup.rs/) (1.77+)
- [Tauri CLI](https://tauri.app/start/): `cargo install tauri-cli`
- macOS: Xcode Command Line Tools
- Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
- Windows: Visual Studio C++ Build Tools

## Architecture

```
[Tauri Webview — vanilla JS SPA]
        ↕ IPC (invoke)
[Rust Backend — src-tauri/]
   ↕            ↕              ↕
[SQLite]   [memory/*.md]   [AI API]
```

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | Vanilla JS, Tailwind CSS | SPA with 7 views |
| Backend | Rust, Tauri v2 | SQLite, SRS, AI, file I/O |
| Database | SQLite + FTS5 | Words, cards, grammar, settings |
| AI | reqwest HTTP | Anthropic, OpenAI, Gemini, Mistral, GLM |
| STT | whisper-rs (optional) | Speech-to-text via Whisper |
| TTS | Web Speech API | Native browser voices |

## AI Providers

Configure in **Settings > AI Provider**. Bring your own API key.

| Provider | Models | Free tier? |
|----------|--------|-----------|
| Anthropic | claude-haiku-4-5, claude-sonnet-4, claude-opus-4 | No |
| OpenAI | gpt-4o-mini, gpt-4o, codex-mini | No |
| Gemini | gemini-2.0-flash, gemini-2.5-flash/pro | Yes (free tier) |
| Mistral | mistral-small/medium/large | Yes (free tier) |
| GLM (Zhipu) | glm-4-flash, glm-4 | Yes (free tier) |
| Claude CLI | claude-haiku-4-5 (local) | Requires Claude CLI |

## Project Structure

```
omnilingo/
├── index.html              # SPA entry point
├── style.css               # Custom theme + Tailwind
├── js/
│   ├── bridge.js           # Tauri IPC bridge (44 methods)
│   ├── srs.js              # SRS wrapper
│   ├── app.js              # Router + state + settings
│   ├── views/              # 7 views (dashboard, learn, review, ...)
│   └── components/         # Flashcard, Exercise, ProgressBar
├── data/
│   ├── dictionary.json     # 500+ DE-FR words (builtin)
│   ├── verbs.json          # 100+ conjugated verbs
│   ├── grammar-topics.json # 36 grammar lessons
│   └── dictionary-sources.json  # 305 FreeDict pairs catalog
├── memory/                 # Markdown progress files
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs          # Tauri setup + 30 commands
│   │   ├── db.rs           # SQLite + migrations
│   │   └── commands/       # 10 command modules
│   └── migrations/         # SQL schema
└── .github/workflows/      # CI/CD
```

## Development

```bash
# Check compilation (fast after first build)
cd src-tauri && cargo check

# Run with hot reload
cargo tauri dev

# Clippy lint
cargo clippy -- -D warnings
```

## Contributing

1. Fork the repo
2. Create a branch (`git checkout -b feature/amazing`)
3. Commit with [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.)
4. Push and open a PR

## License

[MIT](LICENSE)
