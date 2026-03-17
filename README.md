# Omnilingo

App desktop pour apprendre les langues, construite avec [Tauri v2](https://tauri.app), React et TypeScript.

## Fonctionnalites

- **Flashcards SRS** — Algorithme SM-2 avec repetition espacee (Oublie / Difficile / Bien / Facile)
- **Dictionnaire** — 500+ mots DE-FR integres, recherche, filtres par niveau et categorie
- **Grammaire** — 36 lecons (A1-B1) avec exercices interactifs (QCM, texte a trous, vrai/faux)
- **Conjugaison** — 100+ verbes allemands, 6 temps, 3 modes de pratique
- **Chat IA** — Tuteur de langues multi-provider (Anthropic, OpenAI, Gemini, Mistral, GLM, Claude CLI)
- **Dictionnaires FreeDict** — Catalogue de 305 paires de langues telechargeables
- **Speech-to-Text** — Reconnaissance vocale via Whisper (optionnel)
- **Text-to-Speech** — Synthese vocale via Web Speech API
- **Dark mode** — Theme sombre complet
- **Multi-langues** — Architecture multi-paires (DE-FR par defaut, extensible)

## Prerequis

- [Rust](https://rustup.rs/) (>= 1.77)
- [Bun](https://bun.sh/) (>= 1.0)
- Dependances systeme Tauri ([voir la doc](https://v2.tauri.app/start/prerequisites/))

## Installation

```bash
git clone https://github.com/maxgfr/omnilingo.git
cd omnilingo
bun install
```

## Developpement

```bash
# Lancer l'app en mode dev (hot reload frontend + backend)
cargo tauri dev

# Build frontend seul
bun run build

# Typecheck
bun run --bun tsc --noEmit

# Lint Rust
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

## Build release

```bash
cargo tauri build
```

Les artefacts sont generes dans `src-tauri/target/release/bundle/` :
- **macOS** : `.dmg`, `.app`
- **Windows** : `.msi`, `.exe`

## Structure du projet

```
omnilingo/
├── src/                    Frontend React + TypeScript
│   ├── components/         Composants reutilisables
│   ├── views/              Pages (Dashboard, Learn, Review, ...)
│   ├── store/              React Context (etat global)
│   ├── lib/                Bridge IPC + utilitaires
│   └── types/              Interfaces TypeScript
├── src-tauri/              Backend Rust
│   ├── src/commands/       Commandes IPC
│   └── migrations/         Schemas SQL
├── data/                   Donnees statiques (dictionnaire, grammaire, verbes)
├── memory/                 Fichiers Markdown de progression
└── .github/workflows/      CI/CD (build + release)
```

## CI/CD

| Workflow | Declencheur | Description |
|----------|-------------|-------------|
| `build.yml` | Push/PR sur `main` | TypeScript typecheck + Vite build, puis Clippy Rust sur macOS et Windows |
| `release.yml` | Tag `v*` | Build macOS (arm64 + x64) + Windows (x64), GitHub Release avec auto-update |

### Creer une release

```bash
git tag v2.0.0
git push origin v2.0.0
```

Le workflow `release.yml` :
1. Verifie le typecheck TypeScript
2. Build l'app pour macOS Apple Silicon, macOS Intel et Windows
3. Cree une GitHub Release avec les `.dmg` et `.msi`/`.exe`
4. Genere le `latest.json` pour la mise a jour automatique

### Secrets GitHub (optionnels)

Pour la signature et la notarisation :

| Secret | Description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Cle de signature des artefacts updater |
| `APPLE_CERTIFICATE` | Certificat .p12 encode en base64 |
| `APPLE_CERTIFICATE_PASSWORD` | Mot de passe du certificat |
| `APPLE_SIGNING_IDENTITY` | Identite de signature macOS |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Notarisation Apple |

## Licence

[MIT](LICENSE)
