// chat.js — Chat avec Claude (Tauri v2)

const ChatView = {
  messages: [],
  isLoading: false,

  async render() {
    try {
      const saved = sessionStorage.getItem('omnilingo_chat');
      if (saved) this.messages = JSON.parse(saved);
    } catch { this.messages = []; }

    const pair = App.activePair;
    const langLabel = pair ? `${pair.source_name}` : "l'allemand";

    return `
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Chat avec Claude</h1>
        <p class="text-gray-500 text-sm mt-1">Posez vos questions sur ${langLabel}</p>
      </div>

      <div class="flex flex-wrap gap-2 mb-4">
        <button class="btn btn-outline text-xs" onclick="ChatView.quickAction('correct')">
          Corrige ma phrase
        </button>
        <button class="btn btn-outline text-xs" onclick="ChatView.quickAction('grammar')">
          Explique une règle
        </button>
        <button class="btn btn-outline text-xs" onclick="ChatView.quickAction('conversation')">
          Pratique de conversation
        </button>
        <button class="btn btn-outline text-xs" onclick="ChatView.quickAction('exercises')">
          Exercices sur mes faiblesses
        </button>
        <button class="btn btn-outline text-xs" onclick="ChatView.quickAction('translate')">
          Traduis une phrase
        </button>
      </div>

      <div class="card" style="min-height:400px;display:flex;flex-direction:column">
        <div id="chat-messages" class="flex-1 overflow-y-auto mb-4 space-y-1" style="max-height:50vh">
          ${this.messages.length === 0 ? `
            <div class="text-center text-gray-400 py-12">
              <i data-lucide="message-circle" class="w-10 h-10 mx-auto mb-3 opacity-30"></i>
              <p>Commencez une conversation avec Claude</p>
              <p class="text-xs mt-1">Claude connaît votre niveau et vos progrès</p>
            </div>
          ` : this.messages.map(m => `
            <div class="chat-message ${m.role}">${this._escapeHtml(m.content)}</div>
          `).join('')}
        </div>

        <div id="chat-loading" class="hidden flex items-center gap-2 mb-3 text-sm text-gray-400">
          <div class="spinner"></div>
          <span>Claude réfléchit...</span>
        </div>

        <div class="flex gap-2">
          <input type="text" id="chat-input" class="exercise-input flex-1" placeholder="Écrivez votre message..."
            onkeydown="if(event.key==='Enter' && !event.shiftKey) { event.preventDefault(); ChatView.send(); }">
          <button class="btn btn-primary" onclick="ChatView.send()" id="chat-send-btn">
            <i data-lucide="send" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <div class="mt-3 text-xs text-gray-400">
        Claude utilise votre progression et vos erreurs pour personnaliser ses réponses.
      </div>
    `;
  },

  async send() {
    if (this.isLoading) return;
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    this._addMessage('user', text);
    this.isLoading = true;
    this._showLoading(true);

    const prompt = await this._buildPrompt(text);
    const response = await Bridge.askAi(prompt);

    this.isLoading = false;
    this._showLoading(false);

    if (response && !response.startsWith('Clé API') && !response.startsWith('Erreur')) {
      this._addMessage('assistant', response);
    } else {
      this._addMessage('assistant', response || "Désolé, je n'ai pas pu obtenir de réponse. Configurez votre fournisseur IA dans les Paramètres.");
    }
  },

  async _buildPrompt(userMessage) {
    const level = App.state.level || 'A2';
    const stats = await SRS.getStats(App.pairId());
    const pair = App.activePair;
    const sourceName = pair ? pair.source_name : 'allemand';
    const targetName = pair ? pair.target_name : 'français';

    let errorsContext = '';
    const errors = await Bridge.readMemory('errors.md');
    if (errors) {
      errorsContext = `\nErreurs fréquentes de l'utilisateur:\n${errors.slice(0, 500)}\n`;
    }

    return `Tu es un professeur de ${sourceName} patient et encourageant. L'utilisateur est ${targetName}phone, niveau ${level} en ${sourceName}.
Stats: ${stats.total_cards} mots appris, ${stats.average_accuracy}% de précision.
${errorsContext}
Règles:
- Réponds en ${targetName} par défaut, avec les exemples en ${sourceName}
- Adapte tes explications au niveau ${level}
- Utilise des exemples concrets et quotidiens
- Si l'utilisateur écrit en ${sourceName}, corrige ses erreurs et explique
- Sois concis mais complet

Message de l'utilisateur: ${userMessage}`;
  },

  quickAction(type) {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const pair = App.activePair;
    const sourceName = pair ? pair.source_name.toLowerCase() : 'allemand';

    const prompts = {
      'correct': `Corrige cette phrase en ${sourceName} (je vais l'écrire) : `,
      'grammar': `Explique-moi cette règle de grammaire en ${sourceName} : `,
      'conversation': `Pratiquons une conversation en ${sourceName} ! Commence un dialogue simple sur un sujet du quotidien. Je suis niveau ${App.state.level || 'A2'}.`,
      'exercises': 'Génère des exercices ciblés sur mes points faibles. Inclus des exercices à trous et des QCM.',
      'translate': `Traduis cette phrase en ${sourceName} : `,
    };

    input.value = prompts[type] || '';
    input.focus();

    if (type === 'conversation' || type === 'exercises') {
      this.send();
    }
  },

  _addMessage(role, content) {
    this.messages.push({ role, content });
    this._saveMessages();
    this._renderMessages();
  },

  _renderMessages() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = this.messages.map(m =>
      `<div class="chat-message ${m.role}">${this._escapeHtml(m.content)}</div>`
    ).join('');
    container.scrollTop = container.scrollHeight;
  },

  _showLoading(show) {
    const el = document.getElementById('chat-loading');
    const btn = document.getElementById('chat-send-btn');
    if (el) el.classList.toggle('hidden', !show);
    if (btn) btn.disabled = show;
  },

  _saveMessages() {
    try {
      const toSave = this.messages.slice(-20);
      sessionStorage.setItem('omnilingo_chat', JSON.stringify(toSave));
    } catch {}
  },

  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  },
};
