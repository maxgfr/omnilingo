// Static example data for all features — shown when no results yet
// All content in DE-FR (German source, French target)

export const REPHRASE_EXAMPLE = {
  sampleInput: "Kannst du mir den Bericht schicken?",
  alternatives: [
    { text: "Ich wäre Ihnen dankbar, wenn Sie mir den Bericht zusenden könnten.", tone: "formal", note: "Plus poli, adapté aux e-mails professionnels" },
    { text: "Könntest du mir den Bericht schicken?", tone: "simple", note: "Direct et clair, adapté à la plupart des contextes" },
    { text: "Hey, schick mir mal den Bericht!", tone: "informal", note: "Ton familier, entre amis ou collègues proches" },
  ],
};

export const CORRECTOR_EXAMPLE = {
  sampleInput: "Ich habe ein Hund und er laufen gern im Park.",
  corrected: "Ich habe einen Hund und er läuft gern im Park.",
  corrections: [
    { wrong: "ein Hund", right: "einen Hund", explanation: "L'accusatif est requis après 'haben' : 'ein' devient 'einen' au masculin" },
    { wrong: "er laufen", right: "er läuft", explanation: "Le verbe doit être conjugué à la 3e personne du singulier : 'laufen' → 'läuft'" },
  ],
  score: "fair" as const,
  feedback: "Bon effort ! Attention à l'accusatif avec 'haben' et à la conjugaison des verbes irréguliers.",
};

export const SYNONYMS_EXAMPLE = {
  sampleInput: "froh",
  synonyms: [
    {
      word: "glücklich",
      register: "neutral",
      definition: "qui ressent du bonheur ou du contentement",
      example: { source: "Ich bin **glücklich**, dir zu helfen.", target: "Je suis **content** de t'aider." },
    },
    {
      word: "erfreut",
      register: "formal",
      definition: "qui éprouve de la joie, du plaisir",
      example: { source: "Ich bin **erfreut**, Sie kennenzulernen.", target: "Je suis **ravi** de faire votre connaissance." },
    },
    {
      word: "fröhlich",
      register: "neutral",
      definition: "visiblement joyeux et optimiste",
      example: { source: "Sie hat eine **fröhliche** Persönlichkeit.", target: "Elle a une personnalité **enjouée**." },
    },
  ],
};

export const MINING_SAMPLE_INPUT = "Der Wetterbericht sagt Regen für das Wochenende voraus. Ich lerne seit drei Jahren Deutsch und finde die Grammatik immer noch schwierig.";

export const MINING_EXAMPLE = [
  {
    sentence: "Der Wetterbericht sagt Regen für das Wochenende voraus.",
    translation: "La météo prévoit de la pluie pour le week-end.",
    keyWords: [
      { word: "Wetterbericht", translation: "bulletin météo", level: "B1" },
      { word: "voraussagen", translation: "prévoir", level: "B1" },
      { word: "Wochenende", translation: "week-end", level: "A1" },
    ],
    grammar: "Verbe à particule séparable : 'voraus|sagen' — le préfixe va en fin de phrase",
  },
  {
    sentence: "Ich lerne seit drei Jahren Deutsch.",
    translation: "J'apprends l'allemand depuis trois ans.",
    keyWords: [
      { word: "lernen", translation: "apprendre", level: "A1" },
      { word: "seit", translation: "depuis", level: "A2" },
    ],
    grammar: "'Seit' + datif pour exprimer la durée (équivalent de 'depuis' en français)",
  },
];

export const CONJUGATION_EXAMPLE = {
  infinitive: "machen",
  translation: "faire",
  persons: ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"],
  forms: ["mache", "machst", "macht", "machen", "macht", "machen"],
  tense: "Präsens",
};

export const GRAMMAR_EXAMPLE = {
  title: "Nominativ und Akkusativ",
  level: "A1",
  explanation: "Le **nominatif** est le cas du sujet. L'**accusatif** est le cas du complément d'objet direct. En allemand, l'article change selon le cas.",
  keyPoints: [
    "Nominatif : Der Hund ist groß (Le chien est grand)",
    "Accusatif : Ich sehe den Hund (Je vois le chien)",
    "Seuls les articles masculins changent : der → den, ein → einen",
  ],
  examples: [
    { source: "Der Mann liest ein Buch.", target: "L'homme lit un livre." },
    { source: "Ich kaufe den Kuchen.", target: "J'achète le gâteau." },
  ],
};


export const CONVERSATION_EXAMPLE = [
  { role: "assistant" as const, content: "Guten Tag! Willkommen im Restaurant. Haben Sie reserviert?" },
  { role: "user" as const, content: "Ja, ich habe einen Tisch für zwei Personen reserviert." },
  { role: "assistant" as const, content: "Sehr gut! Hier ist die Speisekarte. Möchten Sie etwas zu trinken bestellen?" },
];
