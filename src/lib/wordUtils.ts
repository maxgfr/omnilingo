/** Shared word parsing & display utilities used by Dictionary and Favorites */

const ACCENT_MAP: Record<string, string> = {
  à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a",
  À: "a", Á: "a", Â: "a", Ã: "a", Ä: "a", Å: "a",
  è: "e", é: "e", ê: "e", ë: "e", È: "e", É: "e", Ê: "e", Ë: "e",
  ì: "i", í: "i", î: "i", ï: "i", Ì: "i", Í: "i", Î: "i", Ï: "i",
  ò: "o", ó: "o", ô: "o", õ: "o", ö: "o", Ò: "o", Ó: "o", Ô: "o", Õ: "o", Ö: "o",
  ù: "u", ú: "u", û: "u", ü: "u", Ù: "u", Ú: "u", Û: "u", Ü: "u",
  ñ: "n", Ñ: "n", ç: "c", Ç: "c", ÿ: "y", Ÿ: "y",
  ß: "ss", æ: "ae", Æ: "ae", œ: "oe", Œ: "oe",
};

/** Normalize a string for accent-insensitive, case-insensitive search (mirrors Rust normalize_for_search). */
export function normalizeForSearch(s: string): string {
  let result = "";
  for (const c of s) {
    const mapped = ACCENT_MAP[c];
    result += mapped !== undefined ? mapped : c.toLowerCase();
  }
  return result;
}

export const levelColors: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  A2: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  B1: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  B2: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  C1: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  C2: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export const genderBadges: Record<string, { label: string; color: string }> = {
  m: { label: "der", color: "bg-blue-500 text-white" },
  f: { label: "die", color: "bg-rose-500 text-white" },
  n: { label: "das", color: "bg-emerald-500 text-white" },
};

export function formatDefinition(text: string): string[] {
  const parts = text.split(/\s*;\s*/).filter((p) => p.trim());
  return parts.length > 1 ? parts : [text];
}

/** Detect whether a semicolon-separated part is a definition (not a short translation). */
const DEFINITION_RE =
  /[:()（）]|^(?:intransitiv|transitiv|reflexiv|intransitif|transitif|pronominal|figuré|familier|bildlich|umgangssprachlich|übertragen|soutenu|vulgaire|péjoratif|archaïque|littéraire|technique|juridique|Geschlecht|gehoben|abwertend|veraltend|mundartlich|regional|schweizerisch|österreichisch|süddeutsch)/i;

/**
 * StarDict/FreeDict metadata tokens that occasionally leak into the target_word
 * field as standalone "translations". These are grammar abbreviations or
 * articles that should never appear in the user-visible translation list.
 */
const METADATA_TOKENS = new Set([
  "art", "art.", "artikel", "wortart",
  "der", "die", "das",
  "le", "la", "les", "un", "une",
  "m", "m.", "f", "f.", "n", "n.",
  "masc", "masc.", "fem", "fem.", "neut", "neut.",
  "verb", "noun", "adj", "adj.", "adv", "adv.",
  "pl", "pl.", "sg", "sg.",
]);
function isMetadataToken(part: string): boolean {
  return METADATA_TOKENS.has(part.toLowerCase());
}

/** Parse target_word to separate IPA, POS, clean text, and split translation vs definition. */
export function parseTargetWord(text: string, category?: string | null, tags?: string | null) {
  let remaining = text;
  let ipa: string | null = null;

  // Extract IPA: / ... / (with unicode phonetic chars)
  const ipaMatch = remaining.match(/\/\s*[^/]+\s*\//);
  if (ipaMatch) {
    ipa = ipaMatch[0].trim();
    remaining = remaining.replace(ipaMatch[0], "");
  }

  // Clean up leading separators
  remaining = remaining.replace(/^[;\s]+/, "").trim();

  // Strip gender artifacts from Kaikki data (e.g. ", female", ", masculine")
  remaining = remaining.replace(/^,?\s*(female|male|masculine|feminine|neuter)\s*/i, "").trim();

  // Extract POS if at start and not already in category
  let pos: string | null = null;
  const posMatch = remaining.match(
    /^(verb|noun|adjective|adverb|preposition|conjunction|pronoun|interjection|article|determiner|particle|name|adjectif|nom|verbe)\s*/i,
  );
  if (posMatch) {
    pos = posMatch[1].toLowerCase();
    remaining = remaining.slice(posMatch[0].length).trim();
  }

  // Use category as POS fallback
  if (!pos && category && category !== "dictionary" && category !== "sentence") {
    pos = category;
  }

  // Use tags as IPA fallback (Kaikki stores IPA in tags)
  if (!ipa && tags && /\/.*\//.test(tags)) {
    ipa = tags;
  }

  // Split clean text into short translation vs long definition
  const parts = remaining
    .split(/\s*;\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    // Drop FreeDict/StarDict metadata tokens that leak into the target field
    .filter((p) => !isMetadataToken(p));
  const translations: string[] = [];
  const definitions: string[] = [];

  for (const part of parts) {
    if (DEFINITION_RE.test(part) || part.length > 80) {
      definitions.push(part);
    } else {
      translations.push(part);
    }
  }

  return {
    clean: remaining,
    ipa,
    pos,
    translation: translations.length > 0 ? translations.join(" ; ") : null,
    definition: definitions.length > 0 ? definitions.join(" ; ") : null,
  };
}

/**
 * Pull foreign-language words out of a free-form target_word string.
 *
 * Many StarDict / FreeDict / Kaikki entries cram both the source-language
 * definition AND the target-language equivalent into the same field, e.g.
 *
 *   "(Intransitif) Se reposer dans un état inconscient, de sommeil schlafen"
 *
 * The user wants "schlafen" surfaced separately as the actual translation,
 * not buried at the end of the French definition.
 *
 * Strategy:
 *   1. Tokenise the text and look up each token (and 2-/3-grams) against
 *      the OPPOSITE pair's source-word set. Tokens that are present in the
 *      opposite dictionary are foreign-language equivalents.
 *   2. Collect those equivalents in the order they appear, deduplicated.
 *   3. Use the matches as the translation; remove them from the text to
 *      build the definition.
 *   4. If nothing matches, fall back to splitting on a definition marker,
 *      otherwise return the whole text as the translation.
 *
 * Multi-word matches are kept intact; the join character is " ; " which
 * formatDefinition() splits on, so multiple distinct equivalents become
 * separate numbered items.
 */
export function extractTranslationsWithWordSet(
  text: string,
  reverseWords: Set<string>,
): { translation: string | null; definition: string | null } {
  const cleaned = text.trim();
  if (!cleaned) return { translation: null, definition: null };

  // Strip parentheticals from matching (they bias towards definitions but are
  // useful to keep in the visible definition output)
  const tokens = cleaned.split(/\s+/);
  const matchedRanges: Array<{ start: number; end: number; phrase: string }> = [];

  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    // Prefer the longest match (3-gram > 2-gram > 1-gram)
    for (let len = Math.min(3, tokens.length - i); len >= 1; len--) {
      const slice = tokens.slice(i, i + len);
      // Skip slices that contain punctuation noise; reject very short single tokens
      const phrase = slice.join(" ").replace(/[(),:;.]/g, "").trim();
      if (!phrase || (len === 1 && phrase.length < 3)) continue;
      const norm = normalizeForSearch(phrase);
      if (reverseWords.has(norm) && !isMetadataToken(phrase)) {
        matchedRanges.push({ start: i, end: i + len, phrase });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }

  if (matchedRanges.length > 0) {
    // Deduplicate phrases (case-insensitive) while preserving first-appearance order
    const seen = new Set<string>();
    const uniquePhrases: string[] = [];
    for (const m of matchedRanges) {
      const key = m.phrase.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniquePhrases.push(m.phrase);
      }
    }

    // Build the definition by removing matched ranges from the token list
    const removed = new Set<number>();
    for (const m of matchedRanges) {
      for (let k = m.start; k < m.end; k++) removed.add(k);
    }
    const definitionTokens = tokens.filter((_, idx) => !removed.has(idx));
    const definition = definitionTokens.join(" ").replace(/\s+/g, " ").trim();

    // Drop noise-only definitions (e.g. lone connectors like "be" or "to")
    const meaningfulDef = definition
      .split(/\s+/)
      .filter((tok) => tok.replace(/[(),:;.]/g, "").length >= 3)
      .join(" ");

    return {
      translation: uniquePhrases.join(" ; "),
      definition: meaningfulDef.length >= 4 ? definition : null,
    };
  }

  // No reverse matches: fall back to definition-marker splitting
  const markerMatch = cleaned.match(DEFINITION_RE);
  if (markerMatch && markerMatch.index !== undefined && markerMatch.index > 0) {
    const trans = cleaned.slice(0, markerMatch.index).trim().replace(/[;,]\s*$/, "");
    const def = cleaned.slice(markerMatch.index).trim();
    return {
      translation: trans.length > 0 ? trans : null,
      definition: def.length > 0 ? def : null,
    };
  }

  // Otherwise treat the whole text as a single translation phrase
  return { translation: cleaned, definition: null };
}
