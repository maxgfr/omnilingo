// conjugation.js — Exercices de conjugaison (Tauri v2)

const ConjugationView = {
  verbs: [],
  currentVerb: null,
  currentTense: null,
  mode: 'select',
  stats: { correct: 0, total: 0 },

  async render() {
    this.verbs = await Bridge.getVerbs(App.pairId());
    this.mode = 'select';
    this.stats = { correct: 0, total: 0 };

    const tenses = ['präsens', 'präteritum', 'perfekt', 'futur1', 'konjunktiv2', 'imperativ'];
    const tenseNames = {
      'präsens': 'Présent (Präsens)', 'präteritum': 'Prétérit (Präteritum)',
      'perfekt': 'Parfait (Perfekt)', 'futur1': 'Futur I',
      'konjunktiv2': 'Subjonctif II (Konjunktiv II)', 'imperativ': 'Impératif (Imperativ)',
    };

    return `
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Conjugaison</h1>
        <p class="text-gray-500 text-sm mt-1">${this.verbs.length} verbes disponibles</p>
      </div>

      <div id="conj-select">
        <div class="flex gap-3 mb-6">
          <button class="btn btn-primary" onclick="ConjugationView.startRandom()">
            <i data-lucide="shuffle" class="w-4 h-4"></i> Mode aléatoire
          </button>
        </div>

        <div class="card mb-4">
          <h3 class="font-semibold mb-3">Par temps</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            ${tenses.map(t => `
              <button class="btn btn-outline text-left" onclick="ConjugationView.startByTense('${t}')">
                ${tenseNames[t]}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <h3 class="font-semibold mb-3">Par verbe</h3>
          <input type="text" class="exercise-input w-full mb-3" placeholder="Rechercher un verbe..." id="conj-search" oninput="ConjugationView.filterVerbs()">
          <div class="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-80 overflow-y-auto" id="conj-verb-list">
            ${this._renderVerbList(this.verbs)}
          </div>
        </div>
      </div>

      <div id="conj-practice" class="hidden"></div>
    `;
  },

  _renderVerbList(verbs) {
    return verbs.map(v => `
      <button class="btn btn-outline text-left text-sm" onclick="ConjugationView.startByVerb('${v.infinitive}')">
        <span class="font-medium">${v.infinitive}</span>
        <span class="text-gray-400 ml-1">${v.translation}</span>
        ${v.level ? `<span class="tag tag-${v.level.toLowerCase()} ml-auto">${v.level}</span>` : ''}
      </button>
    `).join('');
  },

  async filterVerbs() {
    const q = document.getElementById('conj-search').value.toLowerCase();
    const filtered = this.verbs.filter(v =>
      v.infinitive.toLowerCase().includes(q) || v.translation.toLowerCase().includes(q)
    );
    const list = document.getElementById('conj-verb-list');
    if (list) list.innerHTML = this._renderVerbList(filtered);
  },

  startRandom() {
    this.mode = 'random';
    this.stats = { correct: 0, total: 0 };
    this._nextRandom();
  },

  startByTense(tense) {
    this.currentTense = tense;
    this.mode = 'tense';
    this.stats = { correct: 0, total: 0 };
    const available = this.verbs.filter(v => v.conjugations && v.conjugations[tense]);
    if (available.length === 0) return;
    this.currentVerb = available[Math.floor(Math.random() * available.length)];
    this._showPractice();
  },

  startByVerb(infinitive) {
    const verb = this.verbs.find(v => v.infinitive === infinitive);
    if (!verb) return;
    this.currentVerb = verb;
    this.currentTense = 'präsens';
    this.mode = 'verb';
    this.stats = { correct: 0, total: 0 };
    this._showPractice();
  },

  _nextRandom() {
    const tenses = ['präsens', 'präteritum', 'perfekt', 'futur1'];
    this.currentTense = tenses[Math.floor(Math.random() * tenses.length)];
    const available = this.verbs.filter(v => v.conjugations && v.conjugations[this.currentTense]);
    this.currentVerb = available[Math.floor(Math.random() * available.length)];
    this._showPractice();
  },

  _showPractice() {
    const select = document.getElementById('conj-select');
    const practice = document.getElementById('conj-practice');
    if (select) select.classList.add('hidden');
    if (practice) {
      practice.classList.remove('hidden');
      practice.innerHTML = this._renderPractice();
      lucide.createIcons();
    }
  },

  _renderPractice() {
    const v = this.currentVerb;
    const t = this.currentTense;
    const tenseNames = {
      'präsens': 'Présent', 'präteritum': 'Prétérit', 'perfekt': 'Parfait',
      'futur1': 'Futur I', 'konjunktiv2': 'Subjonctif II', 'imperativ': 'Impératif',
    };

    const conj = v.conjugations[t] || {};
    const isImperativ = t === 'imperativ';
    const persons = isImperativ ? ['du', 'ihr', 'Sie'] : ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];

    return `
      <button class="btn btn-outline mb-4" onclick="ConjugationView.backToSelect()">
        <i data-lucide="arrow-left" class="w-4 h-4"></i> Retour
      </button>

      <div class="card mb-4">
        <div class="flex items-center gap-3 mb-1">
          <h2 class="text-xl font-bold">${v.infinitive}</h2>
          <span class="text-gray-400">${v.translation}</span>
          ${v.level ? `<span class="tag tag-${v.level.toLowerCase()}">${v.level}</span>` : ''}
          ${v.verb_type ? `<span class="tag" style="background:var(--gray-100);color:var(--gray-500)">${v.verb_type}</span>` : ''}
        </div>
        <p class="text-sm text-gray-500">Temps : <strong>${tenseNames[t]}</strong></p>
        ${v.auxiliary ? `<p class="text-xs text-gray-400">Auxiliaire : ${v.auxiliary}</p>` : ''}
        <button class="btn btn-outline mt-2 text-xs" onclick="Flashcard.speak('${v.infinitive}')">
          <i data-lucide="volume-2" class="w-3 h-3"></i> Écouter
        </button>
      </div>

      <div class="card mb-4" id="conj-exercise">
        <p class="font-medium mb-3">Conjuguez <strong>${v.infinitive}</strong> au <strong>${tenseNames[t]}</strong> :</p>
        <div class="space-y-3">
          ${persons.map(p => `
            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-500 w-20 text-right font-medium">${p}</span>
              <input type="text" class="exercise-input flex-1" data-person="${p}" placeholder="..." autocomplete="off"
                onkeydown="if(event.key==='Enter')ConjugationView.check()">
            </div>
          `).join('')}
        </div>
        <div class="flex gap-3 mt-4">
          <button class="btn btn-primary" onclick="ConjugationView.check()">Vérifier</button>
          <button class="btn btn-outline" onclick="ConjugationView.showAnswers()">Voir les réponses</button>
        </div>
        <div id="conj-feedback" class="mt-3 hidden"></div>
      </div>

      <div class="flex gap-3">
        ${this.mode === 'random' ? `<button class="btn btn-primary" onclick="ConjugationView._nextRandom()">Suivant</button>` : ''}
        ${this.mode === 'tense' ? `<button class="btn btn-primary" onclick="ConjugationView.startByTense('${t}')">Autre verbe</button>` : ''}
        ${this.mode === 'verb' ? this._renderTenseButtons() : ''}
      </div>

      <div class="mt-4 text-sm text-gray-400">
        Score : ${this.stats.correct}/${this.stats.total}
      </div>
    `;
  },

  _renderTenseButtons() {
    const tenses = ['präsens', 'präteritum', 'perfekt', 'futur1', 'konjunktiv2', 'imperativ'];
    const names = { 'präsens': 'Prés.', 'präteritum': 'Prét.', 'perfekt': 'Perf.', 'futur1': 'Fut.', 'konjunktiv2': 'Konj.II', 'imperativ': 'Imp.' };
    return `<div class="flex flex-wrap gap-2">${tenses.map(t =>
      `<button class="btn ${t === this.currentTense ? 'btn-primary' : 'btn-outline'} text-xs" onclick="ConjugationView.switchTense('${t}')">${names[t]}</button>`
    ).join('')}</div>`;
  },

  switchTense(tense) {
    this.currentTense = tense;
    this._showPractice();
  },

  async check() {
    const container = document.getElementById('conj-exercise');
    if (!container || container.dataset.checked) return;
    container.dataset.checked = 'true';

    const conj = this.currentVerb.conjugations[this.currentTense] || {};
    const inputs = container.querySelectorAll('input[data-person]');
    let allCorrect = true;
    const errors = [];

    inputs.forEach(input => {
      const person = input.dataset.person;
      const answer = input.value.trim().toLowerCase();
      const expected = (conj[person] || '').toLowerCase().replace(/!$/, '').trim();
      const expectedRaw = conj[person] || '';
      const answerNorm = answer.replace(/!$/, '').trim();
      const isCorrect = answerNorm === expected;

      input.classList.add(isCorrect ? 'correct' : 'incorrect');
      input.readOnly = true;

      if (!isCorrect) {
        allCorrect = false;
        errors.push({ person, expected: expectedRaw, given: input.value });
      }
    });

    this.stats.total++;
    if (allCorrect) this.stats.correct++;

    const fb = document.getElementById('conj-feedback');
    if (fb) {
      fb.classList.remove('hidden');
      fb.innerHTML = allCorrect
        ? '<p style="color:var(--success)" class="font-semibold">✓ Parfait !</p>'
        : `<p style="color:var(--error)" class="font-semibold">✗ Corrections :</p>
           <div class="text-sm mt-1 space-y-1">${errors.map(e =>
             `<p><span class="text-gray-500">${e.person} →</span> <strong>${e.expected}</strong> <span class="text-gray-400">(vous : ${e.given || '—'})</span></p>`
           ).join('')}</div>`;
    }

    await Bridge.logConjugationSession(
      App.pairId(), this.currentVerb.infinitive, this.currentTense,
      allCorrect, errors.map(e => e.person)
    );
  },

  showAnswers() {
    const container = document.getElementById('conj-exercise');
    if (!container) return;
    const conj = this.currentVerb.conjugations[this.currentTense] || {};
    const inputs = container.querySelectorAll('input[data-person]');
    inputs.forEach(input => {
      const person = input.dataset.person;
      input.value = conj[person] || '';
      input.classList.add('correct');
      input.readOnly = true;
    });
    container.dataset.checked = 'true';
  },

  backToSelect() {
    const select = document.getElementById('conj-select');
    const practice = document.getElementById('conj-practice');
    if (select) select.classList.remove('hidden');
    if (practice) practice.classList.add('hidden');
  },
};
