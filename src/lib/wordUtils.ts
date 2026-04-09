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
  const parts = remaining.split(/\s*;\s*/).filter((p) => p.trim());
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
 * Extract translations from target_word text by matching tokens against a known word set
 * from the reverse language pair. This handles messy Kaikki data where definitions and
 * translations are concatenated without clear separators.
 */
export function extractTranslationsWithWordSet(
  text: string,
  reverseWords: Set<string>,
): { translation: string | null; definition: string | null } {
  const tokens = text.split(/\s+/);
  if (tokens.length <= 3 && !DEFINITION_RE.test(text)) {
    return { translation: text, definition: null };
  }

  const found: string[] = [];
  const defTokens: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    // Try 3-word, 2-word, then 1-word match against reverse dictionary
    let matched = false;
    for (let len = 3; len >= 1; len--) {
      if (i + len > tokens.length) continue;
      const phrase = tokens.slice(i, i + len).join(" ");
      const normPhrase = normalizeForSearch(phrase);
      if (reverseWords.has(normPhrase) && phrase.length > 2) {
        if (!found.includes(phrase)) found.push(phrase);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      defTokens.push(tokens[i]);
      i++;
    }
  }

  const defText = defTokens.join(" ").trim();
  return {
    translation: found.length > 0 ? found.join(" ; ") : null,
    definition: defText.length > 0 ? defText : null,
  };
}
