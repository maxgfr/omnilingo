# Omnilingo v2

## Projet

App desktop **Tauri v2** (Rust + React + TypeScript) pour apprendre les langues.
Interface en **francais**. Multi-langues : DE-FR, EN-FR, etc.

## Architecture

```
src/                     Frontend React + TypeScript
  ├── App.tsx            Routes (HashRouter)
  ├── main.tsx           Point d'entree
  ├── index.css          Tailwind CSS v4 + custom
  ├── types/index.ts     Interfaces TypeScript
  ├── lib/bridge.ts      IPC Tauri (invoke)
  ├── lib/speech.ts      TTS Web Speech API
  ├── store/AppContext.tsx  React Context global
  ├── components/        Layout, Flashcard, ProgressBar, Exercise
  └── views/             Dashboard, Learn, Review, Grammar,
                         Conjugation, Dictionary, Chat, Settings

src-tauri/               Backend Rust
  ├── src/lib.rs         Setup Tauri + commandes
  ├── src/db.rs          SQLite + migrations
  ├── src/commands/      ai, srs, dictionary, grammar,
  │                      conjugation, import, memory,
  │                      settings, speech, download
  └── migrations/        SQL schemas

data/                    JSON statiques (import initial)
memory/                  Fichiers Markdown de progression
```

## Stack

- **Frontend** : React 19, TypeScript 5.8, Vite 7, Tailwind CSS v4, lucide-react, react-router-dom
- **Backend** : Rust, Tauri v2, SQLite (rusqlite), reqwest, chrono
- **Package manager** : bun
- **TTS** : Web Speech API (navigateur)
- **STT** : whisper-rs (optionnel, feature flag `stt`)

## Commandes

```bash
bun install                        # Deps frontend
bun run dev                        # Vite dev server seul
bun run build                      # Build frontend (tsc + vite)
cargo tauri dev                    # App complete en dev
cargo tauri build                  # Build release
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings  # Lint Rust
```

## IPC

Le bridge (`src/lib/bridge.ts`) expose des fonctions typees qui appellent les commandes Rust via `invoke()` de `@tauri-apps/api/core`. Toutes les commandes Rust sont dans `src-tauri/src/commands/`.

## SRS

Algorithme SM-2 en Rust (`commands/srs.rs`). 4 boutons : Oublie (0), Difficile (2), Bien (3), Facile (5). Donnees dans SQLite, sync auto vers `memory/vocabulary.md`.

## Providers IA

Anthropic, OpenAI, Gemini, Mistral, GLM, Claude CLI (subprocess local sans cle API).

## CI/CD

- `build.yml` : Typecheck (tsc) + Vite build sur ubuntu, puis Clippy sur macOS + Windows — sur push/PR main
- `release.yml` : Typecheck gate, puis build macOS (arm64 + x64) + Windows (x64) avec tauri-action, GitHub Release + auto-update JSON — sur tag `v*`

### Secrets GitHub (optionnels)

| Secret | Usage |
|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Signer les artefacts updater |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Mot de passe de la cle |
| `APPLE_CERTIFICATE` | Certificat .p12 base64 (macOS signing) |
| `APPLE_CERTIFICATE_PASSWORD` | Mot de passe du certificat |
| `APPLE_SIGNING_IDENTITY` | Identite de signature |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Notarisation macOS |
