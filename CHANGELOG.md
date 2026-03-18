# [2.3.0](https://github.com/maxgfr/omnilingo/compare/v2.2.1...v2.3.0) (2026-03-18)


### Features

* simplify app — reduce navigation from 12 to 5 items ([dd0879c](https://github.com/maxgfr/omnilingo/commit/dd0879c44e29247dee491960b9c2b92285521ee9))

## [2.2.1](https://github.com/maxgfr/omnilingo/compare/v2.2.0...v2.2.1) (2026-03-18)


### Bug Fixes

* restore ad-hoc macOS signing to fix "damaged app" error ([c3613a1](https://github.com/maxgfr/omnilingo/commit/c3613a1d9c0e81ca0f15fe49b39d19b882b964a6))

# [2.2.0](https://github.com/maxgfr/omnilingo/compare/v2.1.2...v2.2.0) (2026-03-18)


### Features

* add Linux builds, commitlint for conventional commits ([a4768d5](https://github.com/maxgfr/omnilingo/commit/a4768d5b73831f7703eb26daff40439f1fc542c2))

## [2.1.2](https://github.com/maxgfr/omnilingo/compare/v2.1.1...v2.1.2) (2026-03-18)


### Bug Fixes

* switch to semantic-release, fix macOS notarization error ([a323253](https://github.com/maxgfr/omnilingo/commit/a323253efd222aef2e2f4982f69f30bb311de077))

# Changelog

## [2.1.1](https://github.com/maxgfr/omnilingo/compare/v2.1.0...v2.1.1) (2026-03-18)


### Bug Fixes

* merge release build into release-please workflow ([eef5ecb](https://github.com/maxgfr/omnilingo/commit/eef5ecbb720b0901fb8636d5413e03e30a371710))
* trigger release build on release published event ([072e75c](https://github.com/maxgfr/omnilingo/commit/072e75c254b775fe9ca8512c728c75274875c78c))

## [2.1.0](https://github.com/maxgfr/omnilingo/compare/v2.0.0...v2.1.0) (2026-03-18)


### Features

* add i18n with react-i18next, AI translation support ([21cf540](https://github.com/maxgfr/omnilingo/commit/21cf540457ea571b49ae9d48a4b991552b909117))
* add Stats, Quiz, Onboarding, Word of Day, Favorites, FTS5 ([b19963e](https://github.com/maxgfr/omnilingo/commit/b19963e910c7a74baea9e43fd19ecabd76b9d177))
* AI config overhaul + export/import progression ([6fffea6](https://github.com/maxgfr/omnilingo/commit/6fffea62656c051143acfea0847a0d1efc18965b))
* AI generators, flashcards, conversation mode, streak calendar ([51cfd24](https://github.com/maxgfr/omnilingo/commit/51cfd247157302e598ff5c4d9c6e29f02d2ff3a4))
* complete i18n coverage, add auto-update system ([509ea41](https://github.com/maxgfr/omnilingo/commit/509ea41b256d9b6dac2b09349b916a99674d108f))
* dictionary catalog fix, multi-pair switcher, empty state CTA ([143a297](https://github.com/maxgfr/omnilingo/commit/143a29722ddb2709c7ebc2d7de58e9d53e13037e))
* download dictionaries from onboarding + Settings ([8b4db3a](https://github.com/maxgfr/omnilingo/commit/8b4db3abe725296eff1b770d5e4369b87ebafc68))
* dynamic model catalog from models.dev API ([8c32d0b](https://github.com/maxgfr/omnilingo/commit/8c32d0b6b0d01f782cc342afe1f1271d95833db1))
* free model input, Claude Code + Codex providers, aliases ([1933fd0](https://github.com/maxgfr/omnilingo/commit/1933fd0392c6cc55129b748e92c93c27d5f1c8c1))
* import dictionaries from CSV/TSV/JSON files ([33155a1](https://github.com/maxgfr/omnilingo/commit/33155a14a88165702bb72c21e8a05987b3b0c0be))
* Ollama detection, notifications, Settings improvements ([0103f9a](https://github.com/maxgfr/omnilingo/commit/0103f9aeadc2770e890f7b28cc51ee1fe3eb759d))
* proper onboarding (native + target lang + level) + TODO.md ([dfad331](https://github.com/maxgfr/omnilingo/commit/dfad3310f158032e104542b0c78eb780349c7019))
* remove static data, dictionary-first approach ([fd61043](https://github.com/maxgfr/omnilingo/commit/fd61043a5156d47b8d631c36acc4d7846cc1b4a1))
* semantic release automation with auto-update support ([21c47dd](https://github.com/maxgfr/omnilingo/commit/21c47ddd3a9436309d58e0c799de1137fef3f2ed))
* Settings cleanup — delete words, models, translations, cache ([2999459](https://github.com/maxgfr/omnilingo/commit/2999459019856d254600c983e1dea0952b897557))
* translate UI to English, fix TTS, add STT recording ([b2585dc](https://github.com/maxgfr/omnilingo/commit/b2585dc12fae96f5b12554c2cbc4f04d99cde121))
* UX improvements — mic button, error logging, transitions ([dc295fb](https://github.com/maxgfr/omnilingo/commit/dc295fb76c4e4a5256c0dcc1760e048fa6669e21))
* UX overhaul — favorites, spelling, reverse cards, cmd+K, more ([73bf691](https://github.com/maxgfr/omnilingo/commit/73bf691949baf658908563f1d9e2e80bfc044b9c))


### Bug Fixes

* AI-driven empty states across all views ([333452b](https://github.com/maxgfr/omnilingo/commit/333452bd00ba82348c05f7ba54691633caadbd2c))
* app crash — skip updater plugin in dev mode ([8b20fa8](https://github.com/maxgfr/omnilingo/commit/8b20fa85e55315926e98a6d82d115bc9f25e5f0b))
* complete i18n coverage — 331 keys synced en/fr ([882726d](https://github.com/maxgfr/omnilingo/commit/882726d429eafd55b675458bfb5a3e1676491e2a))
* default AI provider to claude-code (no API key needed) ([c05d506](https://github.com/maxgfr/omnilingo/commit/c05d5061aad23273329d7a3f97b0da4851459dd5))
* translate all Rust backend + AI prompts to English ([f3d86d9](https://github.com/maxgfr/omnilingo/commit/f3d86d9143517dae9fa87688aea2b0590810e3c0))
* TTS/STT improvements, whisper-rs 0.16 API fix ([3f5c760](https://github.com/maxgfr/omnilingo/commit/3f5c760e52647f40e713a0c153a9faa3530e6940))
