# Omnilingo v2 — App desktop multi-langues

## Structure du projet

App desktop **Tauri v2** (Rust + vanilla JS) pour apprendre les langues.
Interface en **français**. Multi-langues : DE↔FR, EN↔FR, etc.

## Architecture

```
[Fenêtre Tauri — webview]
        ↕ IPC (invoke)
[Backend Rust — src-tauri/]
   ↕            ↕              ↕
[SQLite]   [memory/*.md]   [AI API (multi-provider)]
```

- `index.html` + `style.css` + `js/` — SPA frontend (vanilla JS, Tailwind CDN)
- `src-tauri/` — Backend Rust (Tauri v2, SQLite, reqwest)
- `data/` — Données statiques JSON (import initial vers SQLite)
- `memory/` — Fichiers Markdown de progression (contexte IA)
- `.github/workflows/` — CI/CD cross-platform

## Fichiers clés

### Frontend (js/)
- `bridge.js` — IPC vers Rust via `__TAURI__.core.invoke()`
- `srs.js` — Wrapper mince (SM-2 est dans Rust)
- `app.js` — Routeur SPA + état global + paramètres
- `views/` — Dashboard, Learn, Review, Grammar, Conjugation, Dictionary, Chat
- `components/` — Flashcard, Exercise, ProgressBar

### Backend (src-tauri/src/)
- `lib.rs` — Setup Tauri, enregistrement commandes
- `db.rs` — Init SQLite + migrations
- `commands/ai.rs` — Multi-provider IA (Anthropic, OpenAI, Gemini, Mistral, GLM, Claude CLI)
- `commands/srs.rs` — SM-2 atomique en Rust + sync vocabulary.md
- `commands/dictionary.rs` — CRUD mots, recherche FTS
- `commands/grammar.rs` — Topics + progression
- `commands/conjugation.rs` — Verbes + conjugaisons
- `commands/import.rs` — Import JSON → SQLite au 1er lancement
- `commands/memory.rs` — Lecture/écriture fichiers markdown
- `commands/settings.rs` — Settings + paires de langues
- `commands/speech.rs` — STT via Whisper (whisper-rs), téléchargement modèles
- `commands/download.rs` — Téléchargement dictionnaires FreeDict + catalogue

## Providers IA supportés

| Provider | API | Modèle par défaut |
|----------|-----|-------------------|
| Anthropic | Messages API | claude-haiku-4-5-20251001 |
| OpenAI/Codex | Chat Completions | gpt-4o-mini |
| Google Gemini | generateContent | gemini-2.0-flash |
| Mistral | Chat Completions (compatible OpenAI) | mistral-small-latest |
| GLM (Zhipu) | Chat Completions (compatible OpenAI) | glm-4-flash |
| Claude CLI | Subprocess local (sans clé API) | claude-haiku-4-5-20251001 |

## Fichiers memory/

- `progress.md` — Stats globales
- `vocabulary.md` — Table SRS (source de vérité)
- `grammar-log.md` — Historique grammaire
- `conjugation-log.md` — Historique conjugaison
- `errors.md` — Erreurs fréquentes pour ciblage IA
- `sessions/YYYY-MM-DD.md` — Journal quotidien

## Algorithme SRS

SM-2 en Rust avec 4 boutons : Oublié (0), Difficile (2), Bien (3), Facile (5).
Données dans SQLite (source de vérité) + sync auto vers `memory/vocabulary.md`.

## Speech

- **STT** : whisper-rs (whisper.cpp) — modèles tiny/base/small téléchargeables
- **TTS** : Web Speech API (navigateur) — voix natives OS, fonctionne offline

## Sources de dictionnaires

- **FreeDict** : 305 paires, StarDict, GPL — `data/dictionary-sources.json`
- **Tatoeba** : 57 paires de phrases, CC BY 2.0
- **Données intégrées** : DE-FR builtin (500+ mots, 100+ verbes, 36 grammaire)

## Commandes de dev

```bash
cargo tauri dev      # Lance l'app en mode dev
cargo tauri build    # Build release (.dmg/.app/.exe)
```
