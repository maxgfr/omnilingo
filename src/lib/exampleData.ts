// Static example data for all features — shown when no results yet.
// Base content is in English. The translateExamples() helper produces a
// per-pair AI-translated copy that's cached in localStorage.

export const REPHRASE_EXAMPLE = {
  sampleInput: "Can you send me the report?",
  alternatives: [
    {
      text: "I would be grateful if you could forward me the report.",
      tone: "formal",
      note: "Polite, suited for professional emails",
    },
    {
      text: "Could you send me the report?",
      tone: "simple",
      note: "Direct and clear, fits most contexts",
    },
    {
      text: "Hey, shoot me that report!",
      tone: "informal",
      note: "Casual tone, between friends or close colleagues",
    },
  ],
};

export const CORRECTOR_EXAMPLE = {
  sampleInput: "I have a dog and he run happy in the park.",
  corrected: "I have a dog and he runs happily in the park.",
  corrections: [
    {
      wrong: "he run",
      right: "he runs",
      explanation: "Third-person singular verbs take an -s ending in the present tense.",
    },
    {
      wrong: "happy",
      right: "happily",
      explanation: "Use the adverb 'happily' to modify the verb 'runs'.",
    },
  ],
  score: "fair" as const,
  feedback: "Good attempt! Watch subject-verb agreement and adverb forms.",
};

export const SYNONYMS_EXAMPLE = {
  sampleInput: "happy",
  synonyms: [
    {
      word: "joyful",
      register: "neutral",
      definition: "feeling great pleasure or contentment",
      example: {
        source: "She gave a **joyful** laugh.",
        target: "She gave a **joyful** laugh.",
      },
    },
    {
      word: "delighted",
      register: "formal",
      definition: "feeling or showing great pleasure",
      example: {
        source: "I am **delighted** to meet you.",
        target: "I am **delighted** to meet you.",
      },
    },
    {
      word: "cheerful",
      register: "neutral",
      definition: "noticeably happy and optimistic",
      example: {
        source: "She has a **cheerful** personality.",
        target: "She has a **cheerful** personality.",
      },
    },
  ],
};

export const MINING_SAMPLE_INPUT =
  "The weather forecast predicts rain for the weekend. I have been learning English for three years and still find the grammar tricky.";

export const MINING_EXAMPLE = [
  {
    sentence: "The weather forecast predicts rain for the weekend.",
    translation: "The weather forecast predicts rain for the weekend.",
    keyWords: [
      { word: "weather forecast", translation: "weather forecast", level: "B1" },
      { word: "predict", translation: "predict", level: "B1" },
      { word: "weekend", translation: "weekend", level: "A1" },
    ],
    grammar: "Present simple for general predictions and stated facts.",
  },
  {
    sentence: "I have been learning English for three years.",
    translation: "I have been learning English for three years.",
    keyWords: [
      { word: "learn", translation: "learn", level: "A1" },
      { word: "for", translation: "for", level: "A2" },
    ],
    grammar: "Present perfect continuous to express duration up to now.",
  },
];

export const DICTIONARY_EXAMPLE = {
  sampleQuery: "house",
  word: "house",
  pos: "noun",
  ipa: "/haʊs/",
  definition: "A building for human habitation, typically one that consists of a ground floor and one or more upper storeys, built for a person or a family to live in.",
  exampleSource: "They live in a small house near the park.",
  exampleTarget: "They live in a small house near the park.",
};

export const CONJUGATION_EXAMPLE = {
  infinitive: "to make",
  translation: "to make",
  persons: ["I", "you", "he/she/it", "we", "you (pl)", "they"],
  forms: ["make", "make", "makes", "make", "make", "make"],
  tense: "Present",
};

export const GRAMMAR_EXAMPLE = {
  title: "Subject and Object",
  level: "A1",
  explanation:
    "The **subject** performs the action. The **object** receives it. Word order in English is generally Subject-Verb-Object.",
  keyPoints: [
    "Subject: The dog is big.",
    "Object: I see the dog.",
    "Pronouns change form: I/me, he/him, she/her, they/them.",
  ],
  examples: [
    { source: "The man reads a book.", target: "The man reads a book." },
    { source: "I buy the cake.", target: "I buy the cake." },
  ],
};

export const CONVERSATION_EXAMPLE = [
  {
    role: "assistant" as const,
    content: "Good evening! Welcome to the restaurant. Do you have a reservation?",
  },
  {
    role: "user" as const,
    content: "Yes, I booked a table for two.",
  },
  {
    role: "assistant" as const,
    content: "Great! Here is the menu. Would you like something to drink?",
  },
];
