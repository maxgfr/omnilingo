// learn.js — Apprendre de nouveaux mots (Tauri v2)

const LearnView = {
  words: [],
  currentIndex: 0,
  addedWords: new Set(),

  async render() {
    const level = App.state.level || 'A2';
    const wordsPerDay = App.state.wordsPerDay || 10;

    // Get unlearned words from Rust backend
    this.words = await Bridge.getUnlearnedWords(App.pairId(), level, wordsPerDay);
    this.currentIndex = 0;
    this.addedWords = new Set();

    if (this.words.length === 0) {
      return `
        <div class="mb-6">
          <h1 class="text-2xl font-bold">Apprendre</h1>
        </div>
        <div class="card text-center py-12">
          <i data-lucide="party-popper" class="w-12 h-12 mx-auto mb-4" style="color:var(--success)"></i>
          <p class="text-lg font-semibold">Tous les mots de votre niveau sont appris !</p>
          <p class="text-gray-500 mt-2">Augmentez votre niveau dans les paramètres ou révisez vos acquis.</p>
          <a href="#review" class="btn btn-primary mt-4">Aller aux révisions</a>
        </div>
      `;
    }

    return `
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Apprendre de nouveaux mots</h1>
        <p class="text-gray-500 text-sm mt-1">${this.words.length} mots à découvrir aujourd'hui</p>
      </div>

      <div id="learn-progress" class="mb-4">
        ${ProgressBar.render(0, this.words.length, { label: 'Progression', showPercent: false })}
      </div>

      <div id="learn-card-area" class="flex flex-col items-center">
        ${this._renderCurrentCard()}
      </div>

      <div id="learn-complete" class="hidden card text-center py-8">
        <i data-lucide="trophy" class="w-12 h-12 mx-auto mb-4" style="color:var(--accent)"></i>
        <p class="text-lg font-semibold">Session terminée !</p>
        <p class="text-gray-500 mt-2" id="learn-summary"></p>
        <div class="flex gap-3 justify-center mt-4">
          <a href="#review" class="btn btn-primary">Réviser</a>
          <button class="btn btn-outline" onclick="LearnView.restart()">Encore des mots</button>
        </div>
      </div>
    `;
  },

  _renderCurrentCard() {
    if (this.currentIndex >= this.words.length) return '';
    const w = this.words[this.currentIndex];
    const isAdded = this.addedWords.has(w.id);

    // Convert backend word to flashcard format
    const entry = {
      de: w.source_word,
      fr: w.target_word,
      gender: w.gender,
      plural: w.plural,
      level: w.level,
      category: w.category,
      example: w.example_source ? { de: w.example_source, fr: w.example_target || '' } : null,
    };

    return `
      ${Flashcard.render(entry, { id: 'learn-flashcard' })}
      <div class="flex items-center gap-3 mt-4">
        <button class="btn btn-outline" onclick="Flashcard.speak('${(w.source_word || '').replace(/'/g, "\\'")}')">
          <i data-lucide="volume-2" class="w-4 h-4"></i> Écouter
        </button>
        <button class="btn ${isAdded ? 'btn-success' : 'btn-primary'}" id="learn-add-btn" onclick="LearnView.addToReview()" ${isAdded ? 'disabled' : ''}>
          <i data-lucide="${isAdded ? 'check' : 'plus'}" class="w-4 h-4"></i>
          ${isAdded ? 'Ajouté' : 'Ajouter aux révisions'}
        </button>
      </div>
      <div class="flex gap-3 mt-4">
        <button class="btn btn-outline" onclick="LearnView.prev()" ${this.currentIndex === 0 ? 'disabled style="opacity:0.3"' : ''}>
          <i data-lucide="chevron-left" class="w-4 h-4"></i> Précédent
        </button>
        <span class="text-sm text-gray-400 self-center">${this.currentIndex + 1} / ${this.words.length}</span>
        <button class="btn btn-outline" onclick="LearnView.next()">
          Suivant <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  },

  async addToReview() {
    const w = this.words[this.currentIndex];
    if (this.addedWords.has(w.id)) return;

    await SRS.addWord(w.id);
    this.addedWords.add(w.id);

    const btn = document.getElementById('learn-add-btn');
    if (btn) {
      btn.className = 'btn btn-success';
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Ajouté';
      lucide.createIcons();
    }

    this._updateProgress();
  },

  next() {
    this.currentIndex++;
    if (this.currentIndex >= this.words.length) {
      this._showComplete();
      return;
    }
    this._updateCardArea();
  },

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this._updateCardArea();
    }
  },

  _updateCardArea() {
    const area = document.getElementById('learn-card-area');
    if (area) {
      area.innerHTML = this._renderCurrentCard();
      lucide.createIcons();
    }
    this._updateProgress();
  },

  _updateProgress() {
    const el = document.getElementById('learn-progress');
    if (el) {
      el.innerHTML = ProgressBar.render(this.addedWords.size, this.words.length, { label: 'Progression', showPercent: false });
    }
  },

  _showComplete() {
    const area = document.getElementById('learn-card-area');
    const complete = document.getElementById('learn-complete');
    const summary = document.getElementById('learn-summary');
    if (area) area.classList.add('hidden');
    if (complete) complete.classList.remove('hidden');
    if (summary) summary.textContent = `${this.addedWords.size} mot${this.addedWords.size > 1 ? 's' : ''} ajouté${this.addedWords.size > 1 ? 's' : ''} aux révisions.`;
    lucide.createIcons();

    App.logSession('learn', { newWords: this.addedWords.size });
  },

  async restart() {
    const container = document.getElementById('view-container');
    container.innerHTML = await this.render();
    lucide.createIcons();
  },
};
