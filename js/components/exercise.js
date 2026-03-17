// exercise.js — Composant exercice (QCM, trous, réordonner, vrai/faux, conjugaison)

const Exercise = {
  /** Génère un exercice QCM */
  renderQCM(question, options, correctIndex, onAnswer) {
    const id = 'ex-' + Math.random().toString(36).slice(2, 8);
    const html = `
      <div class="card mb-4" id="${id}">
        <p class="font-medium mb-3">${question}</p>
        <div class="space-y-2">
          ${options.map((opt, i) => `
            <div class="qcm-option" data-index="${i}" onclick="Exercise._handleQCM('${id}', ${i}, ${correctIndex})">${opt}</div>
          `).join('')}
        </div>
        <div class="mt-3 text-sm hidden" id="${id}-feedback"></div>
      </div>
    `;

    // Store callback
    Exercise._callbacks[id] = onAnswer;
    return html;
  },

  /** Génère un exercice à trous */
  renderFillBlank(sentence, blank, hint, onAnswer) {
    const id = 'ex-' + Math.random().toString(36).slice(2, 8);
    // Replace ___ or the blank placeholder in the sentence
    const display = sentence.replace('___', `<input type="text" class="exercise-input w-24 mx-1" id="${id}-input" placeholder="${hint || '...'}" autocomplete="off">`);
    const html = `
      <div class="card mb-4" id="${id}">
        <p class="font-medium mb-1">${display}</p>
        <div class="mt-2">
          <button class="btn btn-primary btn-sm" onclick="Exercise._handleFillBlank('${id}', '${blank.replace(/'/g, "\\'")}')">Vérifier</button>
        </div>
        <div class="mt-2 text-sm hidden" id="${id}-feedback"></div>
      </div>
    `;
    Exercise._callbacks[id] = onAnswer;
    return html;
  },

  /** Génère un exercice vrai/faux */
  renderTrueFalse(statement, isTrue, explanation, onAnswer) {
    const id = 'ex-' + Math.random().toString(36).slice(2, 8);
    const html = `
      <div class="card mb-4" id="${id}">
        <p class="font-medium mb-3">${statement}</p>
        <div class="flex gap-2">
          <button class="btn btn-outline" onclick="Exercise._handleTrueFalse('${id}', true, ${isTrue}, '${(explanation || '').replace(/'/g, "\\'")}')">Vrai</button>
          <button class="btn btn-outline" onclick="Exercise._handleTrueFalse('${id}', false, ${isTrue}, '${(explanation || '').replace(/'/g, "\\'")}')">Faux</button>
        </div>
        <div class="mt-2 text-sm hidden" id="${id}-feedback"></div>
      </div>
    `;
    Exercise._callbacks[id] = onAnswer;
    return html;
  },

  /** Génère un exercice de conjugaison */
  renderConjugation(verb, tense, conjugations, onAnswer) {
    const id = 'ex-' + Math.random().toString(36).slice(2, 8);
    const persons = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
    const html = `
      <div class="card mb-4" id="${id}">
        <p class="font-medium mb-1">Conjuguez <strong>${verb}</strong> au <strong>${tense}</strong></p>
        <div class="grid grid-cols-2 gap-2 mt-3">
          ${persons.map(p => `
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500 w-16">${p}</span>
              <input type="text" class="exercise-input flex-1" data-person="${p}" placeholder="..." autocomplete="off">
            </div>
          `).join('')}
        </div>
        <div class="mt-3">
          <button class="btn btn-primary" onclick="Exercise._handleConjugation('${id}')">Vérifier</button>
        </div>
        <div class="mt-2 text-sm hidden" id="${id}-feedback"></div>
      </div>
    `;
    Exercise._conjugations[id] = conjugations;
    Exercise._callbacks[id] = onAnswer;
    return html;
  },

  // Internal state
  _callbacks: {},
  _conjugations: {},

  _handleQCM(id, selected, correct) {
    const container = document.getElementById(id);
    if (!container || container.dataset.answered) return;
    container.dataset.answered = 'true';

    const options = container.querySelectorAll('.qcm-option');
    options.forEach((opt, i) => {
      opt.style.pointerEvents = 'none';
      if (i === correct) opt.classList.add('correct');
      if (i === selected && i !== correct) opt.classList.add('incorrect');
    });

    const isCorrect = selected === correct;
    const fb = document.getElementById(`${id}-feedback`);
    fb.classList.remove('hidden');
    fb.innerHTML = isCorrect
      ? '<span style="color:var(--success)">✓ Correct !</span>'
      : `<span style="color:var(--error)">✗ La bonne réponse était : ${options[correct].textContent}</span>`;

    if (Exercise._callbacks[id]) Exercise._callbacks[id](isCorrect);
  },

  _handleFillBlank(id, correct) {
    const container = document.getElementById(id);
    if (!container || container.dataset.answered) return;
    container.dataset.answered = 'true';

    const input = document.getElementById(`${id}-input`);
    const answer = input.value.trim().toLowerCase();
    const expected = correct.toLowerCase();
    const isCorrect = answer === expected;

    input.classList.add(isCorrect ? 'correct' : 'incorrect');
    input.readOnly = true;

    const fb = document.getElementById(`${id}-feedback`);
    fb.classList.remove('hidden');
    fb.innerHTML = isCorrect
      ? '<span style="color:var(--success)">✓ Correct !</span>'
      : `<span style="color:var(--error)">✗ Réponse attendue : <strong>${correct}</strong></span>`;

    if (Exercise._callbacks[id]) Exercise._callbacks[id](isCorrect);
  },

  _handleTrueFalse(id, userAnswer, correctAnswer, explanation) {
    const container = document.getElementById(id);
    if (!container || container.dataset.answered) return;
    container.dataset.answered = 'true';

    const buttons = container.querySelectorAll('.btn-outline');
    buttons.forEach(b => b.style.pointerEvents = 'none');

    const isCorrect = userAnswer === correctAnswer;
    const fb = document.getElementById(`${id}-feedback`);
    fb.classList.remove('hidden');
    let html = isCorrect
      ? '<span style="color:var(--success)">✓ Correct !</span>'
      : '<span style="color:var(--error)">✗ Incorrect</span>';
    if (explanation) html += `<p class="text-gray-500 mt-1">${explanation}</p>`;
    fb.innerHTML = html;

    if (Exercise._callbacks[id]) Exercise._callbacks[id](isCorrect);
  },

  _handleConjugation(id) {
    const container = document.getElementById(id);
    if (!container || container.dataset.answered) return;
    container.dataset.answered = 'true';

    const conjugations = Exercise._conjugations[id];
    const inputs = container.querySelectorAll('input[data-person]');
    let allCorrect = true;
    const results = [];

    inputs.forEach(input => {
      const person = input.dataset.person;
      const answer = input.value.trim().toLowerCase();
      const expected = (conjugations[person] || '').toLowerCase();
      const isCorrect = answer === expected;
      input.classList.add(isCorrect ? 'correct' : 'incorrect');
      input.readOnly = true;
      if (!isCorrect) {
        allCorrect = false;
        results.push(`${person}: ${conjugations[person]}`);
      }
    });

    const fb = document.getElementById(`${id}-feedback`);
    fb.classList.remove('hidden');
    fb.innerHTML = allCorrect
      ? '<span style="color:var(--success)">✓ Tout est correct !</span>'
      : `<span style="color:var(--error)">✗ Corrections : ${results.join(', ')}</span>`;

    if (Exercise._callbacks[id]) Exercise._callbacks[id](allCorrect);
  },
};
