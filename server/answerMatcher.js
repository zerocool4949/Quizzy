// Fuzzy matching helpers for typed answers

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ') // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance for typo tolerance
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

// Fuzzy matching with typo tolerance (stricter version)
export function looselyMatches(userText, targetText) {
  const u = normalize(userText);
  const t = normalize(targetText);

  if (!u || !t) return false;
  if (u === t) return true;

  // Require minimum length
  if (u.length < 3) return false;

  // Compare without spaces (handles "bonjovi" vs "bon jovi")
  const uNoSpaces = u.replace(/\s/g, '');
  const tNoSpaces = t.replace(/\s/g, '');
  if (uNoSpaces === tNoSpaces) return true;

  // For short targets (single word like "Drake"), require near-exact match
  // User must type at least 70% of the target (ignoring spaces)
  if (uNoSpaces.length < tNoSpaces.length * 0.7) return false;

  // Levenshtein distance on spaceless versions - allow ~15% typos (max 2 chars)
  const maxDistance = Math.min(2, Math.max(1, Math.floor(tNoSpaces.length * 0.15)));
  const distance = levenshtein(uNoSpaces, tNoSpaces);
  if (distance <= maxDistance) return true;

  // For multi-word targets, check if user typed most words correctly
  const targetWords = t.split(' ').filter(w => w.length >= 2);
  const userWords = u.split(' ').filter(w => w.length >= 2);

  if (targetWords.length > 1 && userWords.length > 0) {
    let matchedWords = 0;
    const usedTargetWords = new Set();

    for (const uw of userWords) {
      for (const tw of targetWords) {
        if (usedTargetWords.has(tw)) continue;
        // Word must be close match (1 typo allowed for words 5+ chars)
        const wordMaxDist = tw.length >= 5 ? 1 : 0;
        if (levenshtein(uw, tw) <= wordMaxDist) {
          matchedWords++;
          usedTargetWords.add(tw);
          break;
        }
      }
    }

    // Must match at least 60% of target words (e.g., 2/3 for "Avril Lavigne")
    // AND user must have typed at least half as many words
    if (matchedWords >= targetWords.length * 0.6 && userWords.length >= targetWords.length * 0.5) {
      return true;
    }
  }

  return false;
}
