// dictionary.js — Dictionnaire consultable (Tauri v2)

const DictionaryView = {
  filteredWords: [],
  currentOffset: 0,
  totalCount: 0,

  async render() {
    const categories = await Bridge.getCategories(App.pairId());
    this.totalCount = await Bridge.getWordCount(App.pairId());
    this.currentOffset = 0;

    // Initial load
    this.filteredWords = await Bridge.getWords(App.pairId(), null, 50, 0);
    const stats = await SRS.getStats(App.pairId());

    return `
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Dictionnaire</h1>
        <p class="text-gray-500 text-sm mt-1">${this.totalCount} mots</p>
      </div>

      <div class="card mb-4">
        <div class="flex flex-col md:flex-row gap-3">
          <div class="flex-1">
            <input type="text" class="exercise-input w-full" placeholder="Rechercher..." id="dict-search" oninput="DictionaryView.search()">
          </div>
          <select class="exercise-input" id="dict-level" onchange="DictionaryView.applyFilters()">
            <option value="">Tous niveaux</option>
            <option value="A1">A1</option>
            <option value="A2">A2</option>
            <option value="B1">B1</option>
          </select>
          <select class="exercise-input" id="dict-category" onchange="DictionaryView.applyFilters()">
            <option value="">Toutes catégories</option>
            ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
      </div>

      <div id="dict-results" class="space-y-2">
        ${this._renderResults(this.filteredWords)}
      </div>

      <div class="text-center mt-4" id="dict-load-more-container">
        ${this.filteredWords.length >= 50 ? `
          <button class="btn btn-outline" id="dict-load-more" onclick="DictionaryView.loadMore()">
            Afficher plus
          </button>
        ` : ''}
      </div>
    `;
  },

  _renderResults(words) {
    if (words.length === 0) {
      return '<div class="card text-center py-8 text-gray-500">Aucun résultat</div>';
    }

    const showGender = App.isGerman();

    return words.map(w => {
      const genderColor = w.gender === 'm' ? 'var(--der)' : w.gender === 'f' ? 'var(--die)' : w.gender === 'n' ? 'var(--das)' : 'var(--gray-500)';

      return `
        <div class="card flex items-start gap-3">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              ${showGender && w.gender ? `<span class="text-xs font-bold px-1.5 py-0.5 rounded" style="background:${genderColor}20;color:${genderColor}">${w.gender === 'm' ? 'der' : w.gender === 'f' ? 'die' : 'das'}</span>` : ''}
              <span class="font-semibold">${w.source_word}</span>
              <span class="text-gray-400">→</span>
              <span>${w.target_word}</span>
              ${w.level ? `<span class="tag tag-${w.level.toLowerCase()}">${w.level}</span>` : ''}
            </div>
            ${w.plural ? `<p class="text-xs text-gray-400 mt-0.5">Pluriel : ${w.plural}</p>` : ''}
            ${w.example_source ? `<p class="text-xs text-gray-500 mt-1 italic">"${w.example_source}" — ${w.example_target || ''}</p>` : ''}
            ${w.category ? `<span class="text-xs text-gray-400">${w.category}</span>` : ''}
          </div>
          <div class="flex gap-1">
            <button class="btn btn-outline p-1.5" onclick="Flashcard.speak('${(w.source_word || '').replace(/'/g, "\\'")}')">
              <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
            </button>
            <button class="btn btn-outline p-1.5" onclick="DictionaryView.addWord(${w.id})" title="Ajouter aux révisions">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async search() {
    const query = document.getElementById('dict-search').value.trim();
    const level = document.getElementById('dict-level')?.value || '';
    const category = document.getElementById('dict-category')?.value || '';

    if (query.length > 0) {
      this.filteredWords = await Bridge.searchWords(App.pairId(), query, level || null, category || null);
    } else if (level || category) {
      this.filteredWords = await Bridge.searchWords(App.pairId(), '', level || null, category || null);
    } else {
      this.filteredWords = await Bridge.getWords(App.pairId(), null, 50, 0);
    }
    this.currentOffset = this.filteredWords.length;

    const results = document.getElementById('dict-results');
    if (results) {
      results.innerHTML = this._renderResults(this.filteredWords);
      lucide.createIcons();
    }
  },

  applyFilters() {
    this.search();
  },

  async loadMore() {
    const query = document.getElementById('dict-search')?.value?.trim() || '';
    if (query) return; // No pagination for search results

    const level = document.getElementById('dict-level')?.value || null;
    const more = await Bridge.getWords(App.pairId(), level, 50, this.currentOffset);
    this.filteredWords = this.filteredWords.concat(more);
    this.currentOffset += more.length;

    const results = document.getElementById('dict-results');
    if (results) {
      results.innerHTML = this._renderResults(this.filteredWords);
      lucide.createIcons();
    }

    if (more.length < 50) {
      const container = document.getElementById('dict-load-more-container');
      if (container) container.innerHTML = '';
    }
  },

  async addWord(wordId) {
    await SRS.addWord(wordId);
    // Refresh to update buttons
    this.search();
  },
};
