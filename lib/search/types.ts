import type { QuestionExplanation, Rating } from "@/lib/exam/types";

export type SearchStatusFilter = "wrong" | "reviewed" | "unseen" | "correct";

export interface SearchFilters {
  q: string;
  subject?: string | null;
  topic?: string | null;
  status?: SearchStatusFilter | null;
  evidenceStatus?: QuestionExplanation["evidenceStatus"] | null;
  limit: number;
}

export interface SearchDocument {
  id: string;
  subject: string;
  subjectLabel: string;
  questionText: string;
  answer: string;
  explanation: string;
  options: string[];
  topics: Array<{ id: string; title: string; moduleTitle: string; path: string[] }>;
  sourceLabels: string[];
  evidenceStatus: QuestionExplanation["evidenceStatus"] | null;
  reliabilityLabel: string;
  reviewStatusLabel: string;
  userStats: {
    attempts: number;
    wrong: number;
    correct: number;
    lastRating: Rating | null;
  };
  haystack: {
    question: string;
    answer: string;
    explanation: string;
    metadata: string;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  questionPreview: string;
  answerSnippet: string;
  explanationSnippet: string;
  subjectLabel: string;
  topics: string[];
  source: string | null;
  evidenceStatus: QuestionExplanation["evidenceStatus"] | null;
  reliabilityLabel: string;
  reviewStatusLabel: string;
  userStats: SearchDocument["userStats"];
  tags: string[];
  href: string;
}

export interface SearchResponse {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  facets: {
    subjects: Array<{ id: string; label: string; count: number }>;
    statuses: Array<{ id: SearchStatusFilter; label: string; count: number }>;
  };
}
