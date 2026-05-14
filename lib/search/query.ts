import type { SearchDocument, SearchFilters, SearchResponse, SearchResult, SearchStatusFilter } from "@/lib/search/types";
import { makeSnippet, tokenize, truncateText } from "@/lib/search/normalize";

function matchesStatus(document: SearchDocument, status?: SearchStatusFilter | null) {
  if (!status) return true;
  if (status === "wrong") return document.userStats.wrong > 0 || document.userStats.lastRating === "wrong" || document.userStats.lastRating === "partial";
  if (status === "reviewed") return document.userStats.attempts > 0;
  if (status === "unseen") return document.userStats.attempts === 0;
  return document.userStats.correct > 0 || document.userStats.lastRating === "correct" || document.userStats.lastRating === "easy";
}

function scoreDocument(document: SearchDocument, tokens: string[]) {
  if (tokens.length === 0) return 1;
  let score = 0;
  let matched = 0;

  for (const token of tokens) {
    let tokenScore = 0;
    if (document.haystack.question.includes(token)) tokenScore += 12;
    if (document.haystack.answer.includes(token)) tokenScore += 10;
    if (document.haystack.explanation.includes(token)) tokenScore += 6;
    if (document.haystack.metadata.includes(token)) tokenScore += 4;
    if (tokenScore > 0) matched += 1;
    score += tokenScore;
  }

  if (matched === tokens.length) score += 16;
  if (matched === 0) return 0;
  return score;
}

function tagsFor(document: SearchDocument) {
  const tags = [document.subjectLabel, document.evidenceStatus ?? "no evidence"];
  if (document.userStats.wrong > 0) tags.push("wrong");
  if (document.userStats.attempts > 0) tags.push("reviewed");
  if (document.userStats.attempts === 0) tags.push("unseen");
  return tags;
}

function toResult(document: SearchDocument, score: number, tokens: string[]): SearchResult {
  return {
    id: document.id,
    score,
    questionPreview: truncateText(document.questionText, 260),
    answerSnippet: makeSnippet(document.answer || document.options.join(" "), tokens, 220),
    explanationSnippet: makeSnippet(document.explanation, tokens, 240),
    subjectLabel: document.subjectLabel,
    topics: document.topics.slice(0, 4).map((topic) => topic.title),
    source: document.sourceLabels[0] ?? null,
    evidenceStatus: document.evidenceStatus,
    reliabilityLabel: document.reliabilityLabel,
    reviewStatusLabel: document.reviewStatusLabel,
    userStats: document.userStats,
    tags: tagsFor(document).slice(0, 6),
    href: `/studio?question=${encodeURIComponent(document.id)}`,
  };
}

function buildFacets(documents: SearchDocument[]): SearchResponse["facets"] {
  const subjectCounts = new Map<string, { label: string; count: number }>();
  const statusCounts = new Map<SearchStatusFilter, number>([
    ["wrong", 0],
    ["reviewed", 0],
    ["unseen", 0],
    ["correct", 0],
  ]);

  for (const document of documents) {
    const subject = subjectCounts.get(document.subject) ?? { label: document.subjectLabel, count: 0 };
    subject.count += 1;
    subjectCounts.set(document.subject, subject);
    if (matchesStatus(document, "wrong")) statusCounts.set("wrong", (statusCounts.get("wrong") ?? 0) + 1);
    if (matchesStatus(document, "reviewed")) statusCounts.set("reviewed", (statusCounts.get("reviewed") ?? 0) + 1);
    if (matchesStatus(document, "unseen")) statusCounts.set("unseen", (statusCounts.get("unseen") ?? 0) + 1);
    if (matchesStatus(document, "correct")) statusCounts.set("correct", (statusCounts.get("correct") ?? 0) + 1);
  }

  return {
    subjects: Array.from(subjectCounts, ([id, value]) => ({ id, label: value.label, count: value.count })).sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
    statuses: [
      { id: "wrong", label: "Wrong", count: statusCounts.get("wrong") ?? 0 },
      { id: "reviewed", label: "Reviewed", count: statusCounts.get("reviewed") ?? 0 },
      { id: "unseen", label: "Unseen", count: statusCounts.get("unseen") ?? 0 },
      { id: "correct", label: "Correct", count: statusCounts.get("correct") ?? 0 },
    ],
  };
}

export function runSearch(documents: SearchDocument[], filters: SearchFilters): SearchResponse {
  const tokens = tokenize(filters.q);
  const candidates = documents.filter((document) => {
    if (filters.subject && document.subject !== filters.subject) return false;
    if (filters.topic && !document.topics.some((topic) => topic.id === filters.topic || topic.moduleTitle === filters.topic)) return false;
    if (filters.evidenceStatus && document.evidenceStatus !== filters.evidenceStatus) return false;
    return matchesStatus(document, filters.status);
  });

  const results = candidates
    .map((document) => ({ document, score: scoreDocument(document, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.document.questionText.localeCompare(b.document.questionText))
    .slice(0, filters.limit)
    .map((item) => toResult(item.document, item.score, tokens));

  return {
    query: filters.q,
    filters,
    results,
    facets: buildFacets(documents),
  };
}
