import { getQuestions } from "@/lib/exam/repository";
import { buildSearchDocuments } from "@/lib/search/indexer";
import { runSearch } from "@/lib/search/query";
import type { SearchFilters, SearchResponse } from "@/lib/search/types";

export async function searchQuestions(userId: string, filters: SearchFilters): Promise<SearchResponse> {
  const questions = await getQuestions({
    userId,
    subject: filters.subject,
    topic: filters.topic,
    includeReview: false,
    limit: 1000,
    order: "ordered",
  });
  return runSearch(buildSearchDocuments(questions), filters);
}
