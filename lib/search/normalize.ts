export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

export function truncateText(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

export function makeSnippet(value: string, tokens: string[], maxLength = 240) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "";

  const normalized = normalizeText(compact);
  const hit = tokens.find((token) => normalized.includes(token));
  if (!hit) return truncateText(compact, maxLength);

  const hitIndex = normalized.indexOf(hit);
  const start = Math.max(0, hitIndex - Math.floor(maxLength / 3));
  const end = Math.min(compact.length, start + maxLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < compact.length ? "..." : "";
  return `${prefix}${compact.slice(start, end).trim()}${suffix}`;
}
