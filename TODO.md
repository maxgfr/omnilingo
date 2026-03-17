# Omnilingo v2 — TODO

## Légende
- `[ ]` À faire
- `[x]` Fait
- `[~]` Partiellement fait / MVP

---

## 0. Validation & Stabilisation

- [ ] **Premier lancement complet** — `cargo tauri dev`, vérifier que la fenêtre s'ouvre et le dashboard s'affiche
- [ ] **Vérifier l'import auto** — Au 1er lancement, les 500+ mots DE-FR, 100+ verbes, 36 grammaire doivent être dans SQLite
- [ ] **Tester chaque vue** — Dashboard, Learn, Review, Grammar, Conjugation, Dictionary, Chat, Settings
- [ ] **Tester le cycle SRS complet** — Apprendre un mot → passe en révision → noter → interval se met à jour
- [ ] **Tester le chat IA** — Configurer une clé API, envoyer un message, recevoir une réponse
- [ ] **Tester la persistance** — Fermer l'app, rouvrir, vérifier que les données sont conservées
- [ ] **Vérifier vocabulary.md** — Après une review, le fichier doit être synchronisé
- [ ] **Vérifier progress.md** — Stats mises à jour après chaque session

---

## 1. StarDict Parser (dictionnaires FreeDict)

- [x] Catalogue des 305 paires FreeDict dans `data/dictionary-sources.json`
- [x] Commande `download_dictionary` — télécharge l'archive .tar.xz
- [ ] **Parser le format StarDict** — .ifo (metadata), .idx (index binaire), .dict/.dict.dz (définitions)
  - [ ] Parser .ifo (format INI simple)
  - [ ] Parser .idx (word\0 + offset u32 big-endian + size u32 big-endian)
  - [ ] Lire .dict (texte brut aux offsets) ou .dict.dz (gzip)
  - [ ] Décompresser .tar.xz (crate `xz2` + `tar`)
- [ ] **Import en SQLite** — Insérer les mots parsés dans la table `words`
- [ ] **Ajouter dépendances** — `xz2`, `tar` dans Cargo.toml

---

## 2. UI Téléchargement Dictionnaires

- [ ] **Vue "Dictionnaires" dans les paramètres** — Liste des paires disponibles avec bouton "Télécharger"
- [ ] **Recherche/filtre** — Par langue source, langue cible
- [ ] **Indicateur de progression** — Barre de progression pendant le téléchargement
- [ ] **Statut installé/non installé** — Afficher les paires déjà téléchargées
- [ ] **Suppression** — Bouton pour supprimer un dictionnaire téléchargé

---

## 3. Speech-to-Text (STT)

- [x] Backend Whisper via `whisper-rs` (derrière feature flag `stt`)
- [x] Commandes : `get_whisper_models`, `download_whisper_model`, `transcribe_audio`
- [ ] **UI enregistrement audio** — Bouton micro dans la vue Review et Learn
  - [ ] `MediaRecorder` API pour capturer le micro
  - [ ] Conversion en PCM 16kHz mono f32 (requis par Whisper)
  - [ ] Envoi vers Rust pour transcription
- [ ] **UI gestion des modèles** — Dans paramètres, télécharger tiny/base/small
- [ ] **Comparaison prononciation** — Comparer transcription Whisper vs mot attendu
- [ ] **Feedback visuel** — Afficher le score de prononciation (distance d'édition)

---

## 4. Text-to-Speech (TTS) amélioré

- [x] Web Speech API (fonctionne dans le webview, zéro config)
- [ ] **Piper TTS (neural offline)** — Voix de meilleure qualité
  - [ ] Ajouter `piper-rs` en dépendance optionnelle (feature `neural-tts`)
  - [ ] Commande `synthesize_speech(text, lang)` → renvoie audio PCM
  - [ ] Téléchargement des modèles vocaux (~60 MB/langue) : `de_DE-thorsten-medium`, `fr_FR-siwis-medium`, `en_US-lessac-medium`
  - [ ] Fallback Web Speech API si pas de modèle téléchargé
- [ ] **Sélection de voix** — Dans paramètres, choisir entre Web Speech et Piper
- [ ] **Vitesse de lecture** — Slider pour ajuster le débit (0.5x à 1.5x)

---

## 5. Multi-langues — Finalisation

- [x] Architecture multi-paires (table `language_pairs`, `pair_id` partout)
- [x] Sélecteur de paire dans paramètres
- [x] `App.isGerman()` pour UI conditionnelle (genre der/die/das)
- [ ] **Créer paires builtin supplémentaires** — FR→EN, EN→FR (avec données Tatoeba ou FreeDict)
- [ ] **Grammaire par langue** — Les 36 topics actuels sont DE-FR only, ajouter des topics pour d'autres langues
- [ ] **Conjugaison par langue** — Les verbes actuels sont allemands, ajouter support anglais/espagnol
- [ ] **Adapter les exercices** — Certains types d'exercices sont spécifiques à l'allemand (genre, cas)
- [ ] **Labels dynamiques** — Remplacer "Allemand"/"Français" hardcodés restants par `activePair.source_name`

---

## 6. Offline & Assets locaux (Phase 8 du plan)

- [ ] **Télécharger Tailwind browser** dans `vendor/tailwind.js`
- [ ] **Télécharger Lucide icons** dans `vendor/lucide.min.js`
- [ ] **Télécharger police Inter** dans `vendor/inter/`
- [ ] **Mettre à jour index.html** — Remplacer CDN par refs locales
- [ ] **Tester mode offline** — Couper internet, tout doit fonctionner (sauf chat IA cloud)

---

## 7. Build & Distribution

- [x] GitHub Actions workflow (`build.yml`) — macOS, Linux, Windows
- [ ] **Icônes app personnalisées** — Remplacer les icônes par défaut Tauri
  - [ ] Créer icon.png 512x512 (design Omnilingo)
  - [ ] `cargo tauri icon icon.png` pour générer toutes les tailles
- [ ] **Tester `cargo tauri build`** — Vérifier que le .dmg/.app se génère
- [ ] **Tester sur macOS** — Ouvrir le .app, vérifier la signature
- [ ] **GitHub Release** — Tag v2.0.0, pousser, vérifier le workflow CI
- [ ] **Mettre `beforeDevCommand`/`beforeBuildCommand` à `""`** dans tauri.conf.json (pas de npm)
- [ ] **Ajouter .gitignore racine** — target/, omnilingo.db, models/, downloads/, node_modules/

---

## 8. Qualité & UX

- [ ] **Logging des erreurs** — Écrire dans `memory/errors.md` quand l'utilisateur fait une erreur en review/grammaire
- [ ] **Migration localStorage** — Importer les données SRS de la v1 (localStorage) vers SQLite au 1er lancement
- [ ] **FTS5 search** — La recherche utilise LIKE actuellement, migrer vers FTS5 pour les gros dictionnaires
- [ ] **Pagination dictionary** — Limiter à 50 résultats avec scroll infini
- [ ] **Animations transitions** — Ajouter des transitions entre les vues
- [ ] **Raccourcis clavier globaux** — Ctrl+1..7 pour naviguer, Ctrl+R pour refresh
- [ ] **Dark mode CSS complet** — Vérifier que tous les composants supportent le thème sombre
- [ ] **Responsive mobile** — Vérifier le layout sur petits écrans (si jamais Tauri mobile)

---

## 9. Données & Contenu

- [ ] **Enrichir dictionary.json** — Passer de 500+ à 1500+ mots DE-FR (comme prévu dans le plan)
- [ ] **Ajouter des verbes** — Objectif 200+ verbes avec conjugaisons complètes
- [ ] **Ajouter des phrases Tatoeba** — Importer des phrases d'exemple DE-FR depuis Tatoeba CSV
- [ ] **Niveaux B1+ grammaire** — Ajouter 12 topics B2 (Konjunktiv I, Passiv, Relativsätze, etc.)
- [ ] **Catégoriser par thème** — Ajouter des thèmes : voyage, travail, santé, cuisine, etc.

---

## 10. DevOps & Maintenance

- [ ] **Initialiser git** — `git init`, premier commit
- [ ] **Ajouter Clippy CI** — `cargo clippy -- -D warnings` dans le workflow
- [ ] **Tests unitaires Rust** — Tests pour SM-2, import, StarDict parser
- [ ] **Tests E2E** — Utiliser le MCP Tauri pour tests automatisés
- [ ] **README.md** — Instructions d'installation et de contribution
- [ ] **LICENSE** — Choisir une licence (MIT/Apache-2.0)
- [ ] **Changelog** — Documenter les changements v1 → v2

---

## Récapitulatif par priorité

### P0 — Bloquant (faire avant toute utilisation)
1. Premier lancement complet + vérification de chaque vue
2. `.gitignore` + `git init`
3. Fixer `beforeDevCommand`/`beforeBuildCommand` (actuellement `npm run dev/build` qui n'existe pas)

### P1 — Essentiel (fonctionnalités core manquantes)
4. StarDict parser + import FreeDict
5. UI téléchargement dictionnaires
6. Logging des erreurs dans `errors.md`
7. Assets offline (vendor/)

### P2 — Important (amélioration UX)
8. STT UI (micro + comparaison prononciation)
9. Gestion modèles Whisper dans paramètres
10. FTS5 pour la recherche
11. Icônes personnalisées + build release

### P3 — Nice-to-have
12. Piper TTS neural
13. Paires supplémentaires (FR-EN, etc.)
14. Migration localStorage v1
15. Tests unitaires + E2E
16. Contenu additionnel (plus de mots, verbes, grammaire)
