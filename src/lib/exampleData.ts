// Static example data for all features — shown when no results yet

export const REPHRASE_EXAMPLE = {
  sampleInput: "Can you send me the report please?",
  alternatives: [
    { text: "I would be grateful if you could send me the report.", tone: "formal", note: "More polite, suitable for professional emails" },
    { text: "Could you send me that report?", tone: "simple", note: "Direct and clear, suitable for most contexts" },
    { text: "Hey, can you shoot me that report?", tone: "informal", note: "Casual tone, between friends or close colleagues" },
  ],
};

export const CORRECTOR_EXAMPLE = {
  sampleInput: "She don't have no money left.",
  corrected: "She doesn't have any money left.",
  corrections: [
    { wrong: "don't", right: "doesn't", explanation: "Third person singular requires 'doesn't' instead of 'don't'" },
    { wrong: "no money", right: "any money", explanation: "'Any' is used with negative verbs instead of 'no'" },
  ],
  score: "fair" as const,
  feedback: "Good attempt! Watch out for subject-verb agreement with third person singular.",
};

export const SYNONYMS_EXAMPLE = {
  sampleInput: "glad",
  synonyms: [
    {
      word: "happy",
      register: "neutral",
      definition: "feeling pleasure or contentment",
      example: { source: "I'm **happy** to help you.", target: "Je suis **content** de t'aider." },
    },
    {
      word: "joyful",
      register: "formal",
      definition: "feeling great delight",
      example: { source: "It was a **joyful** occasion.", target: "C'était une occasion **joyeuse**." },
    },
    {
      word: "cheerful",
      register: "neutral",
      definition: "noticeably happy and optimistic",
      example: { source: "She has a **cheerful** personality.", target: "Elle a une personnalité **enjouée**." },
    },
  ],
};

export const MINING_SAMPLE_INPUT = "The weather forecast predicts rain for the weekend. I've been studying German for three years now, and I still find the grammar challenging.";

export const MINING_EXAMPLE = [
  {
    sentence: "The weather forecast predicts rain for the weekend.",
    translation: "La météo prévoit de la pluie pour le week-end.",
    keyWords: [
      { word: "forecast", translation: "prévision", level: "B1" },
      { word: "predicts", translation: "prévoit", level: "B1" },
      { word: "weekend", translation: "week-end", level: "A1" },
    ],
    grammar: "Present simple for scheduled or factual events",
  },
  {
    sentence: "I've been studying German for three years.",
    translation: "J'étudie l'allemand depuis trois ans.",
    keyWords: [
      { word: "studying", translation: "étudier", level: "A2" },
      { word: "years", translation: "ans", level: "A1" },
    ],
    grammar: "Present perfect continuous for duration (for + period)",
  },
];

export const CONJUGATION_EXAMPLE = {
  infinitive: "to go",
  translation: "aller",
  persons: ["I", "you", "he/she", "we", "they"],
  forms: ["go", "go", "goes", "go", "go"],
  tense: "Present",
};

export const GRAMMAR_EXAMPLE = {
  title: "Present Simple vs Present Continuous",
  level: "A2",
  explanation: "The **present simple** is used for habits and general truths. The **present continuous** is used for actions happening right now.",
  keyPoints: [
    "Present simple: I work every day",
    "Present continuous: I am working right now",
    "Some verbs (know, want, like) are rarely used in continuous form",
  ],
  examples: [
    { source: "She plays tennis every Sunday.", target: "Elle joue au tennis chaque dimanche." },
    { source: "She is playing tennis right now.", target: "Elle joue au tennis en ce moment." },
  ],
};

export const FLASHCARD_EXAMPLE = {
  front: "apple",
  back: "la pomme",
  gender: "f",
};

export const CONVERSATION_EXAMPLE = [
  { role: "assistant" as const, content: "Guten Tag! Willkommen im Restaurant. Haben Sie reserviert?" },
  { role: "user" as const, content: "Ja, ich habe einen Tisch für zwei Personen reserviert." },
  { role: "assistant" as const, content: "Sehr gut! Hier ist die Speisekarte. Möchten Sie etwas zu trinken bestellen?" },
];
