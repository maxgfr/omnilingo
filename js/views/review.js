// review.js — Révision SRS (Tauri v2)

const ReviewView = {
  dueCards: [],
  currentIndex: 0,
  results: [],
  revealed: false,

  async render() {
    this.dueCards = await Bridge.getDueCards(App.pairId());
    this.currentIndex = 0;
    this.results = [];
    this.revealed = false;

    if (this.dueCards.length === 0) {
      return `
        <div class="mb-6">
          <h1 class="text-2xl font-bold">Réviser</h1>
        </div>
        <div class="card text-center py-12">
          <i data-lucide="check-circle" class="w-12 h-12 mx-auto mb-4" style="color:var(--success)"></i>
          <p class="text-lg font-semibold">Rien à réviser !</p>
          <p class="text-gray-500 mt-2">Revenez plus tard ou apprenez de nouveaux mots.</p>
          <a href="#learn" class="btn btn-primary mt-4">Apprendre</a>
        </div>
      `;
    }

    // Shuffle
    this.dueCards = this._shuffle(this.dueCards);

    return `
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Réviser</h1>
        <p class="text-gray-500 text-sm mt-1">${this.dueCards.length} carte${this.dueCards.length > 1 ? 's' : ''} à revoir</p>
      </div>

      <div id="review-progress" class="mb-4">
        ${ProgressBar.render(0, this.dueCards.length, { label: 'Progression', showPercent: false, color: 'var(--success)' })}
      </div>

      <div id="review-card-area" class="flex flex-col items-center">
        ${this._renderCurrentCard()}
      </div>

      <div id="review-complete" class="hidden">
        ${this._renderComplete()}
      </div>

      <div class="mt-6 text-center text-xs text-gray-400">
        Raccourcis : <span class="kbd">Espace</span> retourner &nbsp;
        <span class="kbd">1</span> Oublié &nbsp;
        <span class="kbd">2</span> Difficile &nbsp;
        <span class="kbd">3</span> Bien &nbsp;
        <span class="kbd">4</span> Facile
      </div>
    `;
  },

  _renderCurrentCard() {
    if (this.currentIndex >= this.dueCards.length) return '';
    const card = this.dueCards[this.currentIndex];
    const showGender = App.isGerman();

    return `
      <div class="flashcard-container" id="review-flashcard" onclick="ReviewView.reveal()">
        <div class="flashcard">
          <div class="flashcard-face">
            <div class="flex gap-2 mb-3">
              ${showGender && card.gender ? `<span class="tag gender-badge-${card.gender}">${card.gender === 'm' ? 'der' : card.gender === 'f' ? 'die' : 'das'}</span>` : ''}
              ${card.level ? `<span class="tag tag-${card.level.toLowerCase()}">${card.level}</span>` : ''}
            </div>
            <p class="text-2xl font-bold ${showGender && card.gender ? 'gender-' + card.gender : ''}">${card.source_word}</p>
            ${card.plural ? `<p class="text-sm text-gray-400 mt-1">Pl. ${card.plural}</p>` : ''}
            <p class="text-xs text-gray-400 mt-4">Cliquer ou <span class="kbd">Espace</span> pour révéler</p>
          </div>
          <div class="flashcard-face flashcard-back">
            <p class="text-xl font-semibold mb-2">${card.target_word}</p>
            ${card.example_source ? `
              <div class="mt-3 text-sm">
                <p class="text-gray-600 italic">"${card.example_source}"</p>
                ${card.example_target ? `<p class="text-gray-400 mt-1">${card.example_target}</p>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <div id="review-buttons" class="flex gap-2 mt-4 ${this.revealed ? '' : 'hidden'}">
        <button class="btn btn-error" onclick="ReviewView.answer(0)">
          Oublié <span class="kbd ml-1">1</span>
        </button>
        <button class="btn btn-outline" onclick="ReviewView.answer(2)" style="border-color:var(--accent);color:var(--accent)">
          Difficile <span class="kbd ml-1">2</span>
        </button>
        <button class="btn btn-success" onclick="ReviewView.answer(3)">
          Bien <span class="kbd ml-1">3</span>
        </button>
        <button class="btn btn-primary" onclick="ReviewView.answer(5)">
          Facile <span class="kbd ml-1">4</span>
        </button>
      </div>

      <div class="flex items-center gap-3 mt-3">
        <button class="btn btn-outline" onclick="Flashcard.speak('${(card.source_word || '').replace(/'/g, "\\'")}')">
          <i data-lucide="volume-2" class="w-4 h-4"></i> Écouter
        </button>
        <span class="text-sm text-gray-400">${this.currentIndex + 1} / ${this.dueCards.length}</span>
      </div>
    `;
  },

  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    const fc = document.querySelector('#review-flashcard .flashcard');
    if (fc) fc.classList.add('flipped');
    const btns = document.getElementById('review-buttons');
    if (btns) btns.classList.remove('hidden');
  },

  async answer(quality) {
    if (!this.revealed) return;
    const card = this.dueCards[this.currentIndex];
    await SRS.review(card.id, quality);

    this.results.push({ word: card.source_word, quality });
    this.currentIndex++;
    this.revealed = false;

    if (this.currentIndex >= this.dueCards.length) {
      this._showComplete();
    } else {
      this._updateCardArea();
    }

    this._updateProgress();
  },

  _updateCardArea() {
    const area = document.getElementById('review-card-area');
    if (area) {
      area.innerHTML = this._renderCurrentCard();
      lucide.createIcons();
    }
  },

  _updateProgress() {
    const el = document.getElementById('review-progress');
    if (el) {
      el.innerHTML = ProgressBar.render(this.currentIndex, this.dueCards.length, { label: 'Progression', showPercent: false, color: 'var(--success)' });
    }
  },

  _showComplete() {
    const area = document.getElementById('review-card-area');
    const complete = document.getElementById('review-complete');
    if (area) area.classList.add('hidden');
    if (complete) {
      complete.innerHTML = this._renderComplete();
      complete.classList.remove('hidden');
    }
    lucide.createIcons();

    App.logSession('review', {
      total: this.results.length,
      correct: this.results.filter(r => r.quality >= 3).length,
      forgotten: this.results.filter(r => r.quality < 3).length,
    });

    App._updateBadge();
  },

  _renderComplete() {
    const correct = this.results.filter(r => r.quality >= 3).length;
    const total = this.results.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const forgotten = this.results.filter(r => r.quality === 0);

    return `
      <div class="card text-center py-8">
        <i data-lucide="trophy" class="w-12 h-12 mx-auto mb-4" style="color:var(--accent)"></i>
        <p class="text-lg font-semibold">Session terminée !</p>

        <div class="grid grid-cols-3 gap-4 mt-6 mb-6">
          <div class="stat-card">
            <div class="stat-value" style="color:var(--success)">${correct}</div>
            <div class="stat-label">Correct${correct > 1 ? 's' : ''}</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${pct}%</div>
            <div class="stat-label">Précision</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color:var(--error)">${forgotten.length}</div>
            <div class="stat-label">Oublié${forgotten.length > 1 ? 's' : ''}</div>
          </div>
        </div>

        ${forgotten.length > 0 ? `
          <div class="text-left mt-4">
            <p class="text-sm font-semibold text-gray-600 mb-2">Mots oubliés (à retravailler) :</p>
            <div class="flex flex-wrap gap-2">
              ${forgotten.map(r => `<span class="tag" style="background:var(--error-light);color:var(--error)">${r.word}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <div class="flex gap-3 justify-center mt-6">
          <a href="#dashboard" class="btn btn-outline">Tableau de bord</a>
          <a href="#learn" class="btn btn-primary">Apprendre</a>
        </div>
      </div>
    `;
  },

  handleKeydown(e) {
    if (App.currentView !== 'review') return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!ReviewView.revealed) ReviewView.reveal();
    } else if (ReviewView.revealed) {
      if (e.key === '1') ReviewView.answer(0);
      else if (e.key === '2') ReviewView.answer(2);
      else if (e.key === '3') ReviewView.answer(3);
      else if (e.key === '4') ReviewView.answer(5);
    }
  },

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
};

document.addEventListener('keydown', (e) => ReviewView.handleKeydown(e));
