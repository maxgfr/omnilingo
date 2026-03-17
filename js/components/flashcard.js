// flashcard.js — Composant carte retournable (Tauri v2, multi-langues)

const Flashcard = {
  render(entry, opts = {}) {
    const id = opts.id || 'flashcard-' + Math.random().toString(36).slice(2, 8);
    const flipped = opts.flipped ? 'flipped' : '';
    const showGender = App.isGerman();
    const genderClass = showGender && entry.gender ? 'gender-' + entry.gender : '';
    const genderBadge = showGender && entry.gender
      ? `<span class="tag gender-badge-${entry.gender}" style="font-size:0.65rem;padding:0.1rem 0.4rem">${entry.gender === 'm' ? 'der' : entry.gender === 'f' ? 'die' : 'das'}</span>`
      : '';
    const levelTag = entry.level ? `<span class="tag tag-${entry.level.toLowerCase()}">${entry.level}</span>` : '';

    return `
      <div class="flashcard-container" id="${id}" onclick="Flashcard.flip('${id}')">
        <div class="flashcard ${flipped}">
          <div class="flashcard-face">
            <div class="flex gap-2 mb-3">${genderBadge} ${levelTag}</div>
            <p class="text-2xl font-bold ${genderClass}">${entry.de}</p>
            ${entry.plural ? `<p class="text-sm text-gray-400 mt-1">Pl. ${entry.plural}</p>` : ''}
            <p class="text-xs text-gray-400 mt-3">Cliquer pour retourner</p>
          </div>
          <div class="flashcard-face flashcard-back">
            <p class="text-xl font-semibold mb-2">${entry.fr}</p>
            ${entry.plural ? `<p class="text-sm text-gray-400">Pluriel : ${entry.plural}</p>` : ''}
            ${entry.example ? `
              <div class="mt-4 text-sm text-left w-full px-4">
                <p class="text-gray-600 italic">"${entry.example.de}"</p>
                <p class="text-gray-400 mt-1">${entry.example.fr}</p>
              </div>
            ` : ''}
            ${entry.category ? `<span class="tag mt-3" style="background:var(--gray-100);color:var(--gray-500)">${entry.category}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  flip(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.flashcard').classList.toggle('flipped');
  },

  /** Prononce un mot dans la langue source active */
  speak(text) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = App.sourceLang();
    utterance.rate = 0.85;
    const voices = speechSynthesis.getVoices();
    const langPrefix = utterance.lang.split('-')[0];
    const voice = voices.find(v => v.lang.startsWith(langPrefix));
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  },
};

// Preload voices
if ('speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
