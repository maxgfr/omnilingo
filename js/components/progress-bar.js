// progress-bar.js — Composant barre de progression réutilisable

const ProgressBar = {
  /**
   * Génère le HTML d'une barre de progression
   * @param {number} value — valeur courante
   * @param {number} max — valeur maximale
   * @param {object} opts — { color, height, label, showPercent }
   */
  render(value, max, opts = {}) {
    const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
    const color = opts.color || 'var(--accent)';
    const height = opts.height || '0.5rem';
    const label = opts.label || '';
    const showPercent = opts.showPercent !== false;

    return `
      <div class="w-full">
        ${label ? `<div class="flex justify-between text-xs text-gray-500 mb-1">
          <span>${label}</span>
          ${showPercent ? `<span>${pct}%</span>` : `<span>${value}/${max}</span>`}
        </div>` : ''}
        <div class="progress-bar-bg" style="height:${height}">
          <div class="progress-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>
    `;
  },

  /** Barre de progression CEFR (A1 → B1) */
  renderCEFR(level) {
    const levels = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };
    const val = levels[level] || 2;
    return `
      <div class="w-full">
        <div class="flex justify-between text-xs mb-1">
          <span class="text-gray-500">Progression CEFR</span>
          <span class="font-semibold" style="color:var(--accent)">${level}</span>
        </div>
        <div class="flex gap-1">
          ${['A1', 'A2', 'B1'].map((l, i) => `
            <div class="flex-1 rounded-full" style="height:0.4rem;background:${i < val ? 'var(--accent)' : 'var(--gray-200)'}"></div>
          `).join('')}
        </div>
        <div class="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>A1</span><span>A2</span><span>B1</span>
        </div>
      </div>
    `;
  },
};
