// dashboard.js — Tableau de bord

const DashboardView = {
  async render() {
    const stats = await SRS.getStats(App.pairId());
    const dueCount = stats.due_count;
    const totalLearned = stats.total_cards;
    const accuracy = stats.average_accuracy;
    const streak = App.state.streak || 0;
    const level = App.state.level || 'A2';
    const wordsPerDay = App.state.wordsPerDay || 10;

    // Grammar progress
    const topics = await Bridge.getGrammarTopics(App.pairId());
    const grammarTotal = topics.length;
    const grammarDone = topics.filter(t => t.completed).length;
    const grammarA1 = topics.filter(t => t.level === 'A1' && t.completed).length;
    const grammarA2 = topics.filter(t => t.level === 'A2' && t.completed).length;
    const grammarB1 = topics.filter(t => t.level === 'B1' && t.completed).length;
    const grammarA1Total = topics.filter(t => t.level === 'A1').length;
    const grammarA2Total = topics.filter(t => t.level === 'A2').length;
    const grammarB1Total = topics.filter(t => t.level === 'B1').length;

    // Update sidebar
    const sidebarLevel = document.getElementById('sidebar-level');
    const sidebarStreak = document.getElementById('sidebar-streak');
    if (sidebarLevel) sidebarLevel.textContent = level;
    if (sidebarStreak) sidebarStreak.textContent = streak;

    // Update review badge
    App._updateBadge();

    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const pair = App.activePair;
    const pairLabel = pair ? `${pair.source_flag} ${pair.source_name} → ${pair.target_flag} ${pair.target_name}` : '';

    return `
      <div class="mb-6">
        <h1 class="text-2xl font-bold">Tableau de bord</h1>
        <p class="text-gray-500 text-sm mt-1">${today}${pairLabel ? ` — ${pairLabel}` : ''}</p>
      </div>

      <!-- Stats cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="card stat-card">
          <div class="stat-value" style="color:var(--accent)">${streak}</div>
          <div class="stat-label">Jours consécutifs</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value" style="color:var(--error)">${dueCount}</div>
          <div class="stat-label">À réviser</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value" style="color:var(--success)">${totalLearned}</div>
          <div class="stat-label">Mots appris</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value">${accuracy}%</div>
          <div class="stat-label">Précision</div>
        </div>
      </div>

      <!-- CEFR Progress -->
      <div class="card mb-6">
        ${ProgressBar.renderCEFR(level)}
      </div>

      <!-- Quick actions -->
      <div class="grid md:grid-cols-2 gap-4 mb-6">
        ${dueCount > 0 ? `
        <a href="#review" class="card flex items-center gap-4 hover:border-amber-300 cursor-pointer" style="text-decoration:none;color:inherit">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background:var(--error-light)">
            <i data-lucide="repeat" class="w-6 h-6" style="color:var(--error)"></i>
          </div>
          <div>
            <p class="font-semibold">Réviser maintenant</p>
            <p class="text-sm text-gray-500">${dueCount} carte${dueCount > 1 ? 's' : ''} à revoir</p>
          </div>
        </a>
        ` : `
        <div class="card flex items-center gap-4 opacity-60">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background:var(--success-light)">
            <i data-lucide="check-circle" class="w-6 h-6" style="color:var(--success)"></i>
          </div>
          <div>
            <p class="font-semibold">Révisions à jour !</p>
            <p class="text-sm text-gray-500">Aucune carte à revoir</p>
          </div>
        </div>
        `}

        <a href="#learn" class="card flex items-center gap-4 hover:border-amber-300 cursor-pointer" style="text-decoration:none;color:inherit">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background:var(--accent-light)">
            <i data-lucide="book-open" class="w-6 h-6" style="color:var(--accent)"></i>
          </div>
          <div>
            <p class="font-semibold">Apprendre de nouveaux mots</p>
            <p class="text-sm text-gray-500">${wordsPerDay} mots par session</p>
          </div>
        </a>

        <a href="#grammar" class="card flex items-center gap-4 hover:border-amber-300 cursor-pointer" style="text-decoration:none;color:inherit">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background:var(--blue-light)">
            <i data-lucide="book-text" class="w-6 h-6" style="color:var(--blue)"></i>
          </div>
          <div>
            <p class="font-semibold">Grammaire</p>
            <p class="text-sm text-gray-500">${grammarDone}/${grammarTotal} sujets complétés</p>
          </div>
        </a>

        <a href="#chat" class="card flex items-center gap-4 hover:border-amber-300 cursor-pointer" style="text-decoration:none;color:inherit">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background:#f3e8ff">
            <i data-lucide="message-circle" class="w-6 h-6" style="color:#7c3aed"></i>
          </div>
          <div>
            <p class="font-semibold">Chat avec Claude</p>
            <p class="text-sm text-gray-500">Explications et exercices IA</p>
          </div>
        </a>
      </div>

      <!-- Grammar progress -->
      <div class="card">
        <h3 class="font-semibold mb-3">Progression grammaire</h3>
        ${ProgressBar.render(grammarDone, grammarTotal || 1, { label: 'Sujets complétés', color: 'var(--blue)' })}
        <div class="grid grid-cols-3 gap-2 mt-4">
          <div class="text-center">
            <span class="tag tag-a1">A1</span>
            <p class="text-xs text-gray-500 mt-1">${grammarA1}/${grammarA1Total}</p>
          </div>
          <div class="text-center">
            <span class="tag tag-a2">A2</span>
            <p class="text-xs text-gray-500 mt-1">${grammarA2}/${grammarA2Total}</p>
          </div>
          <div class="text-center">
            <span class="tag tag-b1">B1</span>
            <p class="text-xs text-gray-500 mt-1">${grammarB1}/${grammarB1Total}</p>
          </div>
        </div>
      </div>
    `;
  },
};
