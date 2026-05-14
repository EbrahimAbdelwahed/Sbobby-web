"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import type { SearchResponse, SearchStatusFilter } from "@/lib/search/types";

const statusOptions: Array<{ id: SearchStatusFilter | ""; label: string }> = [
  { id: "", label: "All" },
  { id: "wrong", label: "Wrong" },
  { id: "reviewed", label: "Reviewed" },
  { id: "unseen", label: "Unseen" },
  { id: "correct", label: "Correct" },
];

export function SearchPageClient() {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<SearchStatusFilter | "">("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (subject) params.set("subject", subject);
    if (status) params.set("status", status);
    params.set("limit", "25");
    return params;
  }, [query, subject, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search?${searchParams.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Search failed with ${response.status}`);
        setData((await response.json()) as SearchResponse);
      } catch (searchError) {
        if (!controller.signal.aborted) {
          setError(searchError instanceof Error ? searchError.message : "Search failed");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [searchParams]);

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="sb-search-controls">
          <label className="sb-search-input-wrap">
            <span className="sb-label">Search cards</span>
            <input
              className="sb-input sb-search-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search questions, answers, explanations, topics, sources"
              type="search"
              value={query}
            />
          </label>
          <label>
            <span className="sb-label">Subject</span>
            <select className="sb-input" onChange={(event) => setSubject(event.target.value)} value={subject}>
              <option value="">All subjects</option>
              {data?.facets.subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sb-label">Status</span>
            <select
              className="sb-input"
              onChange={(event) => setStatus(event.target.value as SearchStatusFilter | "")}
              value={status}
            >
              {statusOptions.map((item) => (
                <option key={item.id || "all"} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      {error ? (
        <EmptyState title="Search is unavailable" description={error} />
      ) : !data && loading ? (
        <SectionCard>
          <p className="text-sm text-[var(--sb-text-dim)]">Loading search index...</p>
        </SectionCard>
      ) : data?.results.length === 0 ? (
        <EmptyState
          title="No matching cards"
          description="Try a shorter term, another subject, or a different review status."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--sb-text-dim)]">
            <span>{data ? `${data.results.length} result${data.results.length === 1 ? "" : "s"}` : "Ready"}</span>
            {loading ? <span>Updating...</span> : null}
          </div>
          {data?.results.map((result) => (
            <article className="sb-search-result" key={result.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="sb-badge">{result.subjectLabel}</span>
                {result.topics.slice(0, 2).map((topic) => (
                  <span className="sb-chip" key={topic}>
                    {topic}
                  </span>
                ))}
                {result.tags.slice(1, 5).map((tag) => (
                  <span className="sb-chip" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <h2>{result.questionPreview}</h2>
              {result.answerSnippet ? <p className="sb-search-answer">{result.answerSnippet}</p> : null}
              {result.explanationSnippet ? <p className="sb-search-snippet">{result.explanationSnippet}</p> : null}
              <div className="sb-search-result-footer">
                <span>
                  Attempts {result.userStats.attempts} · Wrong {result.userStats.wrong} · Correct{" "}
                  {result.userStats.correct}
                </span>
                <span>{result.source ?? result.reliabilityLabel}</span>
                <Link className="sb-button-secondary" href={result.href}>
                  Open in studio
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
