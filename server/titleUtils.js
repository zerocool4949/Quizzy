// Shared title cleanup helpers

// Clean up track titles by removing parenthetical/bracketed content and common suffixes
export function cleanTitle(title) {
  if (!title) return '';

  let cleaned = String(title)
    // Remove all parenthetical content: (Remastered), (Live), (feat. X), etc.
    .replace(/\s*\([^)]*\)/g, '')
    // Remove all bracketed content: [Remastered], [Deluxe], etc.
    .replace(/\s*\[[^\]]*\]/g, '')
    // Remove everything after " - " (usually metadata like Remastered, Live, From Movie, etc.)
    .replace(/\s+-\s+.*$/, '');

  return cleaned.trim();
}
