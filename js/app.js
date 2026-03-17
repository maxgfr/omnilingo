// app.js — Routeur SPA + état global (Tauri v2)

const App = {
  currentView: 'dashboard',
  state: {},
  activePair: null, // { id, source_lang, target_lang, source_name, target_name, source_flag, target_flag }
  languagePairs: [],

  views: {
    dashboard: DashboardView,
    learn: LearnView,
    review: ReviewView,
    grammar: GrammarView,
    conjugation: ConjugationView,
    dictionary: DictionaryView,
    chat: ChatView,
  },

  async init() {
    // Load settings from Rust backend
    await this.loadSettings();

    // Load language pairs
    this.languagePairs = await Bridge.getLanguagePairs();
    this.activePair = this.languagePairs.find(p => p.is_active) || this.languagePairs[0] || null;

    // Setup sidebar
    this._setupSidebar();

    // Setup routing
    window.addEventListener('hashchange', () => this.navigate());

    // Setup theme
    if (this.state.darkMode) {
      document.body.classList.add('dark');
    }

    // Initial navigation
    this.navigate();

    // Initialize memory files if needed
    this._initMemory();

    // Update review badge
    this._updateBadge();

    // Update sidebar info
    this._updateSidebarInfo();
  },

  async loadSettings() {
    const settings = await Bridge.getSettings();
    if (settings) {
      this.state = {
        level: settings.level || 'A2',
        wordsPerDay: settings.words_per_day || 10,
        streak: settings.streak || 0,
        lastSessionDate: settings.last_session_date || null,
        startDate: settings.start_date || null,
        darkMode: settings.dark_mode || false,
        audioEnabled: settings.audio_enabled !== false,
        activePairId: settings.active_language_pair_id || 1,
      };
    } else {
      // Defaults
      this.state = {
        level: 'A2', wordsPerDay: 10, streak: 0, lastSessionDate: null,
        startDate: null, darkMode: false, audioEnabled: true, activePairId: 1,
      };
    }
  },

  /** Get the active language pair ID */
  pairId() {
    return this.activePair ? this.activePair.id : 1;
  },

  /** Is the source language German? (for gender-specific UI) */
  isGerman() {
    return this.activePair && this.activePair.source_lang === 'de';
  },

  /** Get speech language code for source words */
  sourceLang() {
    if (!this.activePair) return 'de-DE';
    const map = { de: 'de-DE', fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT', pt: 'pt-PT' };
    return map[this.activePair.source_lang] || 'de-DE';
  },

  async navigate() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const viewName = hash.split('?')[0];

    if (viewName === 'settings') {
      this.currentView = 'settings';
      this._renderSettings();
      this._updateNav('settings');
      return;
    }

    const view = this.views[viewName];
    if (!view) {
      window.location.hash = '#dashboard';
      return;
    }

    this.currentView = viewName;
    const container = document.getElementById('view-container');
    container.innerHTML = '<div class="flex justify-center py-12"><div class="spinner"></div></div>';

    try {
      const html = await view.render();
      container.innerHTML = html;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) {
      console.error('View render error:', err);
      container.innerHTML = `<div class="card text-center py-8">
        <p class="text-red-500">Erreur lors du chargement de la vue</p>
        <p class="text-sm text-gray-400 mt-2">${err.message}</p>
      </div>`;
    }

    this._updateNav(viewName);
  },

  _updateNav(active) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === active);
    });
  },

  _setupSidebar() {
    const toggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (toggle) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('hidden');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.add('hidden');
      });
    }

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 1024) {
          sidebar.classList.remove('open');
          overlay.classList.add('hidden');
        }
      });
    });
  },

  _updateSidebarInfo() {
    const sidebarLevel = document.getElementById('sidebar-level');
    const sidebarStreak = document.getElementById('sidebar-streak');
    const sidebarPair = document.getElementById('sidebar-pair');
    if (sidebarLevel) sidebarLevel.textContent = this.state.level;
    if (sidebarStreak) sidebarStreak.textContent = this.state.streak;
    if (sidebarPair && this.activePair) {
      sidebarPair.textContent = `${this.activePair.source_flag} ${this.activePair.source_name} → ${this.activePair.target_flag} ${this.activePair.target_name}`;
    }
  },

  async _updateBadge() {
    const badge = document.getElementById('review-badge');
    const dueCount = await SRS.getDueCount(this.pairId());
    if (badge) {
      if (dueCount > 0) {
        badge.textContent = dueCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  },

  async _initMemory() {
    const progress = await Bridge.readMemory('progress.md');
    if (!progress) {
      await Bridge.writeMemory('progress.md', `# Progression Omnilingo\n\n## Vue d'ensemble\n- **Niveau actuel :** ${this.state.level}\n- **Début :** ${new Date().toISOString().slice(0, 10)}\n- **Mots appris :** 0\n`);
    }
    const errors = await Bridge.readMemory('errors.md');
    if (!errors) {
      await Bridge.writeMemory('errors.md', '# Erreurs fréquentes\n\n## Vocabulaire\n| Date | Mot | Erreur | Correction |\n|---|---|---|---|\n\n## Grammaire\n| Date | Sujet | Erreur | Correction |\n|---|---|---|---|\n');
    }
    const grammarLog = await Bridge.readMemory('grammar-log.md');
    if (!grammarLog) {
      await Bridge.writeMemory('grammar-log.md', '# Journal de grammaire\n\n');
    }
    const conjLog = await Bridge.readMemory('conjugation-log.md');
    if (!conjLog) {
      await Bridge.writeMemory('conjugation-log.md', '# Journal de conjugaison\n\n');
    }
  },

  async updateStreak() {
    const result = await Bridge.updateStreak();
    if (result) {
      this.state.streak = result.streak;
      this.state.lastSessionDate = result.last_session_date;
      this._updateSidebarInfo();
    }
  },

  async logSession(type, data) {
    await Bridge.logSession(this.pairId(), type, data);
    await this.updateStreak();
  },

  async updateSetting(key, value) {
    await Bridge.updateSetting(key, value);
    // Update local state
    const stateKeyMap = {
      level: 'level', words_per_day: 'wordsPerDay', dark_mode: 'darkMode',
      audio_enabled: 'audioEnabled',
    };
    if (stateKeyMap[key]) this.state[stateKeyMap[key]] = value;
    this._updateSidebarInfo();
  },

  async switchLanguagePair(pairId) {
    await Bridge.setActiveLanguagePair(pairId);
    this.languagePairs = await Bridge.getLanguagePairs();
    this.activePair = this.languagePairs.find(p => p.id === pairId) || this.languagePairs[0];
    this.state.activePairId = pairId;
    SRS._invalidateCache();
    this._updateSidebarInfo();
    this._updateBadge();
    this.navigate(); // Refresh current view
  },

  async _renderSettings() {
    const container = document.getElementById('view-container');
    const stats = await SRS.getStats(this.pairId());
    const wordCount = await Bridge.getWordCount(this.pairId());
    const aiSettings = await Bridge.getAiSettings() || {};

    const providers = [
      { id: 'anthropic', name: 'Anthropic (Claude)', models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514', 'claude-opus-4-20250514'] },
      { id: 'openai', name: 'OpenAI / Codex', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o3-mini', 'codex-mini-latest'] },
      { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'] },
      { id: 'mistral', name: 'Mistral AI', models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'] },
      { id: 'glm', name: 'GLM (Zhipu)', models: ['glm-4-flash', 'glm-4', 'glm-4-plus'] },
      { id: 'claude-cli', name: 'Claude CLI (local, sans clé)', models: ['claude-haiku-4-5-20251001'] },
    ];

    const currentProvider = aiSettings.provider || 'anthropic';
    const currentModels = providers.find(p => p.id === currentProvider)?.models || [];

    container.innerHTML = `
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Paramètres</h1>
      </div>

      <div class="space-y-4">
        <!-- AI Provider -->
        <div class="card">
          <h3 class="font-semibold mb-3">Fournisseur IA</h3>
          <div class="space-y-4">
            <div>
              <label class="text-sm text-gray-600 block mb-1">Fournisseur</label>
              <select class="exercise-input w-full" id="ai-provider" onchange="App._onProviderChange()">
                ${providers.map(p => `<option value="${p.id}" ${p.id === currentProvider ? 'selected' : ''}>${p.name}</option>`).join('')}
              </select>
            </div>
            <div id="ai-key-row" ${currentProvider === 'claude-cli' ? 'style="display:none"' : ''}>
              <label class="text-sm text-gray-600 block mb-1">Clé API</label>
              <div class="flex gap-2">
                <input type="password" class="exercise-input flex-1" id="ai-api-key"
                       placeholder="${aiSettings.api_key || 'sk-...'}" autocomplete="off">
                <button class="btn btn-outline text-xs" onclick="App.saveAiSettings()">Enregistrer</button>
              </div>
              <p class="text-xs text-gray-400 mt-1">${aiSettings.api_key ? 'Clé configurée : ' + aiSettings.api_key : 'Aucune clé configurée'}</p>
            </div>
            <div>
              <label class="text-sm text-gray-600 block mb-1">Modèle</label>
              <select class="exercise-input w-full" id="ai-model">
                ${currentModels.map(m => `<option value="${m}" ${m === aiSettings.model ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Language pair selector -->
        <div class="card">
          <h3 class="font-semibold mb-3">Paire de langues</h3>
          <div class="space-y-2">
            ${this.languagePairs.map(p => `
              <button class="btn ${p.id === this.pairId() ? 'btn-primary' : 'btn-outline'} w-full text-left"
                      onclick="App.switchLanguagePair(${p.id})">
                ${p.source_flag} ${p.source_name} → ${p.target_flag} ${p.target_name}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <h3 class="font-semibold mb-3">Apprentissage</h3>
          <div class="space-y-4">
            <div>
              <label class="text-sm text-gray-600 block mb-1">Mots par jour</label>
              <select class="exercise-input" onchange="App.updateSetting('words_per_day', this.value)">
                ${[5, 10, 15, 20].map(n => `<option value="${n}" ${this.state.wordsPerDay == n ? 'selected' : ''}>${n} mots</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-sm text-gray-600 block mb-1">Niveau CEFR cible</label>
              <select class="exercise-input" onchange="App.updateSetting('level', this.value)">
                ${['A1', 'A2', 'B1'].map(l => `<option value="${l}" ${this.state.level === l ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="font-semibold mb-3">Interface</h3>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">Mode sombre</p>
              </div>
              <button class="btn ${this.state.darkMode ? 'btn-primary' : 'btn-outline'}" onclick="App.toggleDarkMode()">
                ${this.state.darkMode ? 'Activé' : 'Désactivé'}
              </button>
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">Prononciation audio</p>
              </div>
              <button class="btn ${this.state.audioEnabled ? 'btn-primary' : 'btn-outline'}" onclick="App.toggleAudio()">
                ${this.state.audioEnabled ? 'Activé' : 'Désactivé'}
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="font-semibold mb-3">Données</h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm">Mots dans le dictionnaire</p>
              <span class="text-sm font-mono text-gray-500">${wordCount}</span>
            </div>
            <div class="flex items-center justify-between">
              <p class="text-sm">Mots appris (SRS)</p>
              <span class="text-sm font-mono text-gray-500">${stats.total_cards}</span>
            </div>
            <div class="flex items-center justify-between">
              <p class="text-sm">Précision moyenne</p>
              <span class="text-sm font-mono text-gray-500">${stats.average_accuracy}%</span>
            </div>
          </div>
        </div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _onProviderChange() {
    const provider = document.getElementById('ai-provider').value;
    const keyRow = document.getElementById('ai-key-row');
    if (keyRow) keyRow.style.display = provider === 'claude-cli' ? 'none' : '';

    const providers = {
      anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514', 'claude-opus-4-20250514'],
      openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o3-mini', 'codex-mini-latest'],
      gemini: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
      mistral: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
      glm: ['glm-4-flash', 'glm-4', 'glm-4-plus'],
      'claude-cli': ['claude-haiku-4-5-20251001'],
    };
    const modelSelect = document.getElementById('ai-model');
    if (modelSelect) {
      modelSelect.innerHTML = (providers[provider] || []).map(m => `<option value="${m}">${m}</option>`).join('');
    }
  },

  async saveAiSettings() {
    const provider = document.getElementById('ai-provider').value;
    const apiKey = document.getElementById('ai-api-key')?.value || '';
    const model = document.getElementById('ai-model').value;
    await Bridge.setAiProvider(provider, apiKey, model);
    this._renderSettings(); // Refresh to show masked key
  },

  toggleDarkMode() {
    this.state.darkMode = !this.state.darkMode;
    document.body.classList.toggle('dark', this.state.darkMode);
    this.updateSetting('dark_mode', this.state.darkMode ? '1' : '0');
    this._renderSettings();
  },

  toggleAudio() {
    this.state.audioEnabled = !this.state.audioEnabled;
    this.updateSetting('audio_enabled', this.state.audioEnabled ? '1' : '0');
    this._renderSettings();
  },
};

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
