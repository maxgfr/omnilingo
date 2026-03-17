// grammar.js — Leçons de grammaire (Tauri v2)

const GrammarView = {
  topics: [],
  currentTopic: null,
  exerciseResults: [],

  async render() {
    this.topics = await Bridge.getGrammarTopics(App.pairId());
    this.currentTopic = null;
    this.exerciseResults = [];

    const a1 = this.topics.filter(t => t.level === 'A1');
    const a2 = this.topics.filter(t => t.level === 'A2');
    const b1 = this.topics.filter(t => t.level === 'B1');

    return `
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Grammaire</h1>
        <p class="text-gray-500 text-sm mt-1">${this.topics.length} sujets disponibles</p>
      </div>

      <div id="grammar-list">
        ${this._renderLevel('A1', a1)}
        ${this._renderLevel('A2', a2)}
        ${this._renderLevel('B1', b1)}
      </div>

      <div id="grammar-detail" class="hidden"></div>
    `;
  },

  _renderLevel(level, topics) {
    const doneCount = topics.filter(t => t.completed).length;
    return `
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <span class="tag tag-${level.toLowerCase()}">${level}</span>
          <span class="text-sm text-gray-400">${doneCount}/${topics.length} complétés</span>
        </div>
        <div class="space-y-2">
          ${topics.map(t => {
            return `
              <div class="card flex items-center gap-3 cursor-pointer hover:border-amber-300" onclick="GrammarView.openTopic('${t.id}')">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center ${t.completed ? 'bg-green-100' : 'bg-gray-100'}">
                  ${t.completed ? '<i data-lucide="check" class="w-4 h-4" style="color:var(--success)"></i>' : `<span class="text-xs font-bold text-gray-400">${t.display_order}</span>`}
                </div>
                <div class="flex-1">
                  <p class="font-medium text-sm">${t.title}</p>
                  <p class="text-xs text-gray-400">${t.title_source || ''}</p>
                </div>
                <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300"></i>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  openTopic(id) {
    const topic = this.topics.find(t => t.id === id);
    if (!topic) return;
    this.currentTopic = topic;
    this.exerciseResults = [];

    const list = document.getElementById('grammar-list');
    const detail = document.getElementById('grammar-detail');
    if (list) list.classList.add('hidden');
    if (detail) {
      detail.classList.remove('hidden');
      detail.innerHTML = this._renderTopic(topic);
      lucide.createIcons();
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  _renderTopic(topic) {
    const explanation = this._formatExplanation(topic.explanation || '');
    const keyPoints = topic.key_points || [];
    const examples = topic.examples || [];
    const exercises = topic.exercises || [];

    return `
      <button class="btn btn-outline mb-4" onclick="GrammarView.backToList()">
        <i data-lucide="arrow-left" class="w-4 h-4"></i> Retour
      </button>

      <div class="card mb-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="tag tag-${topic.level.toLowerCase()}">${topic.level}</span>
          <h2 class="text-xl font-bold">${topic.title}</h2>
        </div>
        ${topic.title_source ? `<p class="text-sm text-gray-400 mb-4">${topic.title_source}</p>` : ''}
        <div class="prose text-sm leading-relaxed">${explanation}</div>

        ${keyPoints.length > 0 ? `
          <div class="mt-4 p-3 rounded-lg" style="background:var(--accent-light)">
            <p class="font-semibold text-sm mb-2" style="color:var(--accent)">Points clés :</p>
            <ul class="text-sm space-y-1">
              ${keyPoints.map(p => `<li>• ${p}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      ${examples.length > 0 ? `
        <div class="card mb-4">
          <h3 class="font-semibold mb-3">Exemples</h3>
          <div class="space-y-3">
            ${examples.map(ex => `
              <div class="flex items-start gap-3">
                <div class="flex-1">
                  <p class="font-medium text-sm">${this._highlight(ex.de, ex.highlight)}</p>
                  <p class="text-xs text-gray-500">${ex.fr}</p>
                </div>
                <button class="btn btn-outline p-1" onclick="Flashcard.speak('${(ex.de || '').replace(/'/g, "\\'")}')">
                  <i data-lucide="volume-2" class="w-3 h-3"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="card mb-4">
        <h3 class="font-semibold mb-3">Exercices</h3>
        <div id="grammar-exercises">
          ${this._renderExercises(exercises)}
        </div>
        <div id="grammar-exercise-results" class="hidden mt-4"></div>
      </div>

      <div class="flex gap-3">
        <button class="btn btn-outline" onclick="GrammarView.askClaude()">
          <i data-lucide="message-circle" class="w-4 h-4"></i> Demander à Claude
        </button>
      </div>
    `;
  },

  _renderExercises(exercises) {
    return exercises.map((ex, i) => {
      const onAnswer = (correct) => {
        this.exerciseResults.push(correct);
        if (this.exerciseResults.length === exercises.length) {
          this._showExerciseResults();
        }
      };

      switch (ex.type) {
        case 'qcm':
          return Exercise.renderQCM(ex.question, ex.options, ex.correct, onAnswer);
        case 'fill':
          return Exercise.renderFillBlank(ex.sentence, ex.answer, ex.hint, onAnswer);
        case 'trueFalse':
          return Exercise.renderTrueFalse(ex.statement, ex.correct, ex.explanation, onAnswer);
        default:
          return '';
      }
    }).join('');
  },

  async _showExerciseResults() {
    const correct = this.exerciseResults.filter(r => r).length;
    const total = this.exerciseResults.length;
    const pct = Math.round((correct / total) * 100);

    const el = document.getElementById('grammar-exercise-results');
    if (!el) return;

    const passed = pct >= 70;
    el.classList.remove('hidden');
    el.innerHTML = `
      <div class="p-4 rounded-lg ${passed ? 'bg-green-50' : 'bg-red-50'}">
        <p class="font-semibold ${passed ? 'text-green-700' : 'text-red-700'}">
          ${passed ? '✓ Sujet maîtrisé !' : '✗ Encore un peu de travail'}
        </p>
        <p class="text-sm mt-1 ${passed ? 'text-green-600' : 'text-red-600'}">
          ${correct}/${total} correct${correct > 1 ? 's' : ''} (${pct}%)
        </p>
      </div>
    `;

    if (passed && this.currentTopic) {
      await Bridge.markGrammarCompleted(this.currentTopic.id, App.pairId(), correct, total);
      await App.logSession('grammar', { completed: this.currentTopic.id });
    }
  },

  backToList() {
    const list = document.getElementById('grammar-list');
    const detail = document.getElementById('grammar-detail');
    if (list) list.classList.remove('hidden');
    if (detail) detail.classList.add('hidden');
  },

  async askClaude() {
    if (!this.currentTopic) return;
    const topic = this.currentTopic;
    window.location.hash = '#chat';
    setTimeout(() => {
      const input = document.getElementById('chat-input');
      if (input) {
        input.value = `Explique-moi en détail la règle de grammaire : "${topic.title}" (${topic.title_source || ''}). Donne-moi des exemples supplémentaires et des astuces pour mémoriser.`;
        input.focus();
      }
    }, 200);
  },

  _formatExplanation(text) {
    return text
      .replace(/\n\n/g, '</p><p class="mt-2">')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="px-1 py-0.5 bg-gray-100 rounded text-sm">$1</code>');
  },

  _highlight(text, word) {
    if (!word) return text;
    return text.replace(new RegExp(`(${word})`, 'gi'), '<strong style="color:var(--accent)">$1</strong>');
  },
};
