import { tokenize } from "@/lib/search/normalize";

function levenshteinWithin(a: string, b: string, maxDistance: number) {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    previous = current;
  }
  return previous[b.length];
}

function bestFuzzyTokenScore(token: string, fieldTokens: string[]) {
  if (token.length < 4) return 0;
  const maxDistance = token.length >= 7 ? 2 : 1;
  let best = 0;

  for (const candidate of fieldTokens) {
    if (candidate.length < 4) continue;
    if (candidate.startsWith(token) || token.startsWith(candidate)) {
      best = Math.max(best, 0.75);
      continue;
    }
    const distance = levenshteinWithin(token, candidate, maxDistance);
    if (distance <= maxDistance) {
      best = Math.max(best, distance === 1 ? 0.65 : 0.45);
    }
  }

  return best;
}

export function fuzzyFieldScore(token: string, normalizedField: string) {
  return bestFuzzyTokenScore(token, tokenize(normalizedField));
}
