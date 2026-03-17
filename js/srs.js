// srs.js — Wrapper mince autour du backend Rust SRS
// L'algorithme SM-2 est maintenant dans Rust. Ce fichier fournit une API compatible.

const SRS = {
  // Cache local pour les stats (évite des appels IPC pour le dashboard)
  _stats: null,
  _dueCount: null,

  /** Ajoute un mot aux révisions SRS */
  async addWord(wordId) {
    const card = await Bridge.addWordToSrs(wordId);
    this._invalidateCache();
    return card;
  },

  /** Cartes dues pour révision aujourd'hui */
  async getDueCards(pairId) {
    return await Bridge.getDueCards(pairId);
  },

  /** Nombre de cartes dues */
  async getDueCount(pairId) {
    if (this._dueCount !== null) return this._dueCount;
    const count = await Bridge.getDueCount(pairId);
    this._dueCount = count;
    return count;
  },

  /** Révise une carte (SM-2 côté Rust) */
  async review(cardId, quality) {
    const updated = await Bridge.reviewCard(cardId, quality);
    this._invalidateCache();
    return updated;
  },

  /** Stats SRS (total, dues, précision) */
  async getStats(pairId) {
    if (this._stats) return this._stats;
    const stats = await Bridge.getSrsStats(pairId);
    this._stats = stats;
    return stats;
  },

  /** Invalide le cache local */
  _invalidateCache() {
    this._stats = null;
    this._dueCount = null;
  },

  /** Persiste vers vocabulary.md (fait automatiquement par Rust après review) */
  async persistToMarkdown() {
    // No-op: le backend Rust synchronise automatiquement vocabulary.md
  },
};
