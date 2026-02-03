// Input validation and sanitization for socket events

// Sanitize player name - remove HTML/script tags, limit length
export function sanitizePlayerName(name) {
  if (typeof name !== 'string') return '';

  return name
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous chars
    .trim()
    .slice(0, 20); // Max 20 characters
}

// Validate room code format (4 uppercase alphanumeric, no ambiguous chars)
export function isValidRoomCode(code) {
  if (typeof code !== 'string') return false;
  return /^[A-Z2-9]{4}$/.test(code.toUpperCase());
}

// Sanitize room code - uppercase and validate
export function sanitizeRoomCode(code) {
  if (typeof code !== 'string') return '';
  return code.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);
}

// Validate answer mode
export function isValidAnswerMode(mode) {
  return ['mcq', 'typed', 'movie'].includes(mode);
}

// Validate difficulty (1-3)
export function isValidDifficulty(difficulty) {
  return [1, 2, 3].includes(difficulty);
}

// Validate total rounds (1-30)
export function isValidTotalRounds(rounds) {
  return Number.isInteger(rounds) && rounds >= 1 && rounds <= 30;
}

// Sanitize typed answer text
export function sanitizeAnswerText(text) {
  if (typeof text !== 'string') return '';

  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim()
    .slice(0, 200); // Max 200 characters for an answer
}
