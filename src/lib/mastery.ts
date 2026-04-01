import * as bridge from "./bridge";
import { getPromptContext } from "./ai-cache";
import type { SrsCard, SrsStats, OverviewStats, LanguagePair } from "../types";

// ── Types ────────────────────────────────────────────────────────────

export type ExerciseType = "mcq" | "fill" | "translate" | "construct" | "error_correction";

export interface MasteryExercise {
  type: ExerciseType;
  question: string;
  options?: string[];
  correctAnswer: string;
  hint?: string;
  targetSkill: string;
  difficulty: "review" | "frontier" | "stretch";
}

export interface EvaluationResult {
  correct: boolean;
  score: number;
  feedback: string;
  misconception?: string;
  masterySignal: "not_yet" | "progressing" | "mastered";
}

export interface SessionRound {
  exercise: MasteryExercise;
  userAnswer: string;
  evaluation: EvaluationResult;
}

interface GrammarGap {
  title: string;
  level: string;
  score: number;
}

interface FrequentError {
  word: string;
  type: string;
  count: number;
  correct: string;
}

export interface StudentProfile {
  srsStats: SrsStats;
  overviewStats: OverviewStats;
  frequentErrors: FrequentError[];
  strugglingCards: SrsCard[];
  grammarGaps: GrammarGap[];
  recentContext: string;
}

// ── Data Aggregation ─────────────────────────────────────────────────

export async function getStudentProfile(pairId: number): Promise<StudentProfile> {
  const [srsStats, overviewStats, frequentErrors, dueCards, grammarTopics, recentContext] =
    await Promise.all([
      bridge.getSrsStats(pairId).catch(() => ({ total_cards: 0, due_count: 0, average_accuracy: 0 })),
      bridge.getOverviewStats(pairId).catch(() => ({
        total_words: 0, total_learned: 0, total_reviews: 0,
        total_grammar_completed: 0, total_grammar: 0,
        streak: 0, accuracy: 0, study_days: 0, favorite_count: 0,
      })),
      bridge.getFrequentErrors(pairId, 20).catch(() => [] as FrequentError[]),
      bridge.getDueCards(pairId).catch(() => [] as SrsCard[]),
      bridge.getGrammarTopics(pairId).catch(() => []),
      getPromptContext(pairId).catch(() => ""),
    ]);

  // Sort due cards by ease_factor ascending (hardest first), take top 10
  const strugglingCards = [...dueCards]
    .sort((a, b) => a.ease_factor - b.ease_factor)
    .slice(0, 10);

  // Grammar gaps: incomplete or low score
  const grammarGaps = grammarTopics
    .filter((t) => !t.completed || (t.score_total > 0 && t.score_correct / t.score_total < 0.7))
    .map((t) => ({
      title: t.title,
      level: t.level,
      score: t.score_total > 0 ? Math.round((t.score_correct / t.score_total) * 100) : 0,
    }))
    .slice(0, 10);

  return { srsStats, overviewStats, frequentErrors, strugglingCards, grammarGaps, recentContext };
}

// ── Prompt Builders ──────────────────────────────────────────────────

function formatStudentContext(profile: StudentProfile, pair: LanguagePair, level: string): string {
  const { srsStats, overviewStats, frequentErrors, strugglingCards, grammarGaps } = profile;

  let ctx = `STUDENT PROFILE:
- Learning: ${pair.source_name} from ${pair.target_name}
- CEFR Level: ${level}
- Accuracy: ${overviewStats.accuracy}%
- Words learned: ${overviewStats.total_learned}/${overviewStats.total_words}
- SRS cards: ${srsStats.total_cards} total, ${srsStats.due_count} due for review
- Grammar completed: ${overviewStats.total_grammar_completed}/${overviewStats.total_grammar}
- Study streak: ${overviewStats.streak} days`;

  if (strugglingCards.length > 0) {
    ctx += `\n\nSTRUGGLING VOCABULARY (low ease factor, prioritize these):`;
    for (const card of strugglingCards.slice(0, 8)) {
      ctx += `\n- "${card.source_word}" → "${card.target_word}" (ease: ${card.ease_factor.toFixed(1)}, last score: ${card.last_score ?? "never reviewed"})`;
    }
  }

  if (frequentErrors.length > 0) {
    ctx += `\n\nFREQUENT ERRORS (misconception patterns):`;
    for (const err of frequentErrors.slice(0, 10)) {
      ctx += `\n- "${err.word}" (${err.type}): wrong ${err.count}x, correct answer: "${err.correct}"`;
    }
  }

  if (grammarGaps.length > 0) {
    ctx += `\n\nGRAMMAR GAPS:`;
    for (const gap of grammarGaps.slice(0, 6)) {
      ctx += `\n- ${gap.title} (${gap.level}): ${gap.score}% score`;
    }
  }

  if (profile.recentContext) {
    ctx += `\n\n${profile.recentContext}`;
  }

  return ctx;
}

const EXERCISE_SCHEMA = `{
  "type": "mcq" | "fill" | "translate" | "construct" | "error_correction",
  "question": "the exercise prompt/question",
  "options": ["a","b","c","d"],  // ONLY for mcq type, exactly 4 options
  "correctAnswer": "the correct answer",
  "hint": "optional hint for the student",
  "targetSkill": "what this exercise tests (e.g. 'article agreement', 'past tense', 'word order')",
  "difficulty": "review" | "frontier" | "stretch"
}`;

const EVALUATION_SCHEMA = `{
  "correct": true/false,
  "score": 0-100,
  "feedback": "explanation in the student's native language",
  "misconception": "identified misconception if incorrect (null if correct)",
  "masterySignal": "not_yet" | "progressing" | "mastered"
}`;

export function buildSessionPrompt(
  profile: StudentProfile,
  pair: LanguagePair,
  level: string,
  focus: "vocabulary" | "grammar" | "mixed",
): string {
  const studentCtx = formatStudentContext(profile, pair, level);

  return `You are a Bloom's 2-Sigma mastery tutor for language learning.

${studentCtx}

MASTERY METHODOLOGY (Bloom's 2-Sigma):
1. Target the student's MASTERY FRONTIER — not too easy (they already know it), not too hard (they'll fail and learn nothing).
2. Use the struggling vocabulary and frequent errors above to create exercises that specifically target weak areas.
3. Mix exercise types for engagement: mcq (multiple choice), fill (fill the blank with ___), translate (sentence translation), construct (build a sentence from given words), error_correction (find and fix errors in a sentence).
4. For ${focus === "vocabulary" ? "this session, focus primarily on VOCABULARY: word meanings, usage, gender, articles, and common expressions" : focus === "grammar" ? "this session, focus primarily on GRAMMAR: verb conjugation, sentence structure, cases, prepositions, and grammatical rules" : "this session, MIX vocabulary and grammar exercises equally"}.
5. All questions and sentences MUST be in ${pair.source_name}. Feedback and explanations in ${pair.target_name}.
6. For mcq: provide exactly 4 plausible options. Make distractors realistic (common mistakes, similar words).
7. For fill: use ___ as the blank placeholder in the question.
8. Difficulty levels: "review" = test something they should know, "frontier" = at the edge of their knowledge, "stretch" = slightly above their level.

Generate ONE exercise appropriate for this student. Return ONLY valid JSON:
${EXERCISE_SCHEMA}`;
}

export function buildEvaluationPrompt(
  profile: StudentProfile,
  pair: LanguagePair,
  level: string,
  exercise: MasteryExercise,
  userAnswer: string,
  history: SessionRound[],
): string {
  const studentCtx = formatStudentContext(profile, pair, level);

  const historyStr = history.length > 0
    ? `\nSESSION HISTORY (${history.length} previous exercises):\n` +
      history.map((r, i) =>
        `${i + 1}. [${r.exercise.targetSkill}] ${r.evaluation.correct ? "CORRECT" : "WRONG"}${r.evaluation.misconception ? ` — misconception: "${r.evaluation.misconception}"` : ""}`
      ).join("\n")
    : "";

  return `You are evaluating a language learning exercise answer.

${studentCtx}
${historyStr}

EXERCISE:
- Type: ${exercise.type}
- Question: ${exercise.question}
${exercise.options ? `- Options: ${exercise.options.join(" | ")}` : ""}
- Correct answer: ${exercise.correctAnswer}
- Target skill: ${exercise.targetSkill}

STUDENT'S ANSWER: "${userAnswer}"

EVALUATION RULES:
1. Be generous with minor spelling/accent variations if the meaning is clearly correct.
2. For partial correctness (right idea but wrong form), give partial score (40-70) and signal "progressing".
3. If incorrect, identify the SPECIFIC MISCONCEPTION — what wrong mental model produced this answer? (e.g. "confuses accusative with dative", "thinks all -er verbs are regular").
4. Give feedback in ${pair.target_name}. Be encouraging but precise about the error.
5. masterySignal: "mastered" = solid understanding demonstrated, "progressing" = partially correct or correct after hints, "not_yet" = fundamental misunderstanding.

Return ONLY valid JSON:
${EVALUATION_SCHEMA}`;
}

export function buildNextExercisePrompt(
  profile: StudentProfile,
  pair: LanguagePair,
  level: string,
  history: SessionRound[],
  misconceptions: string[],
  focus: "vocabulary" | "grammar" | "mixed",
): string {
  const studentCtx = formatStudentContext(profile, pair, level);

  const historyStr = history.map((r, i) =>
    `${i + 1}. [${r.exercise.type}/${r.exercise.targetSkill}/${r.exercise.difficulty}] ${r.evaluation.correct ? "CORRECT" : "WRONG"} (score: ${r.evaluation.score})${r.evaluation.misconception ? ` — misconception: "${r.evaluation.misconception}"` : ""}`
  ).join("\n");

  const lastRound = history[history.length - 1];
  const recentCorrect = history.slice(-3).filter((r) => r.evaluation.correct).length;

  let adaptiveInstruction: string;
  if (!lastRound.evaluation.correct) {
    adaptiveInstruction = `The student just got the previous exercise WRONG. SIMPLIFY: create an easier exercise that addresses the same skill ("${lastRound.exercise.targetSkill}") from a different angle. Help them build understanding step by step.`;
  } else if (recentCorrect >= 3) {
    adaptiveInstruction = `The student got the last ${recentCorrect} exercises correct. INCREASE DIFFICULTY: move to a harder concept or a "stretch" level exercise. They're ready for more challenge.`;
  } else {
    adaptiveInstruction = `The student is progressing normally. Stay at the "frontier" difficulty and move to a DIFFERENT target skill than the last exercise.`;
  }

  // Interleaving: every 3-4 exercises, revisit a previously mastered concept
  const shouldInterleave = history.length > 0 && history.length % 3 === 0;
  const interleaveNote = shouldInterleave
    ? `\nINTERLEAVING: This is exercise #${history.length + 1}. Mix in a concept from a previously correct exercise to reinforce long-term retention. Combine it with a new element.`
    : "";

  return `You are a Bloom's 2-Sigma mastery tutor generating the next adaptive exercise.

${studentCtx}

SESSION HISTORY (${history.length} exercises so far):
${historyStr}

${misconceptions.length > 0 ? `ACTIVE MISCONCEPTIONS to address:\n${misconceptions.map((m) => `- ${m}`).join("\n")}` : ""}

ADAPTIVE INSTRUCTION:
${adaptiveInstruction}
${interleaveNote}

RULES:
- Focus: ${focus === "vocabulary" ? "vocabulary" : focus === "grammar" ? "grammar" : "mixed vocabulary and grammar"}.
- DO NOT repeat the same question or very similar questions from the session history.
- Vary exercise types (don't use the same type as the previous exercise: was "${lastRound.exercise.type}").
- All questions in ${pair.source_name}. Feedback in ${pair.target_name}.
- For mcq: exactly 4 plausible options.
- For fill: use ___ as the blank placeholder.

Generate ONE exercise. Return ONLY valid JSON:
${EXERCISE_SCHEMA}`;
}
