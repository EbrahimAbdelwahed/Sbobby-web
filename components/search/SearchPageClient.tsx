"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { QuestionDetailDialog } from "@/components/questions/QuestionDetailDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import type { SearchResponse, SearchStatusFilter } from "@/lib/search/types";

const statusOptions: Array<{ id: SearchStatusFilter | ""; label: string }> = [
  { id: "", label: "Tutte" },
  { id: "wrong", label: "Errori" },
  { id: "reviewed", label: "Riviste" },
  { id: "unseen", label: "Mai viste" },
  { id: "correct", label: "Corrette" },
];

export function SearchPageClient({
  initialStatus = "",
  fixedStatus = false,
}: {
  initialStatus?: SearchStatusFilter | "";
  fixedStatus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<SearchStatusFilter | "">(initialStatus);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<{ id: string; href: string } | null>(null);
  const responseCache = useRef(new Map<string, SearchResponse>());
  const searchInputId = useId();
  const subjectSelectId = useId();
  const statusLabelId = useId();

  const statusCountById = useMemo(
    () => new Map<SearchStatusFilter | "", number>(data?.facets.statuses.map((facet) => [facet.id, facet.count]) ?? []),
    [data?.facets.statuses],
  );

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (subject) params.set("subject", subject);
    if (status) params.set("status", status);
    params.set("limit", "25");
    return params;
  }, [query, subject, status]);

  useEffect(() => {
    const cacheKey = searchParams.toString();
    const cached = responseCache.current.get(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search?${searchParams.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Ricerca non riuscita (${response.status})`);
        const payload = (await response.json()) as SearchResponse;
        responseCache.current.set(cacheKey, payload);
        setData(payload);
      } catch (searchError) {
        if (!controller.signal.aborted) {
          setError(searchError instanceof Error ? searchError.message : "Ricerca non riuscita");
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
      <SectionCard className="sb-question-search-panel">
        <div className="sb-question-search-header">
          <h2>Domande</h2>
          <p>Cerca e filtra le domande per materia e stato.</p>
        </div>

        <div className="sb-question-search-controls">
          <div className="sb-question-search-field">
            <label className="sb-label" htmlFor={searchInputId}>
              Cerca
            </label>
            <input
              id={searchInputId}
              className="sb-input sb-search-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca nelle domande..."
              type="search"
              value={query}
            />
          </div>

          <div className="sb-question-filter-row">
            <label className="sb-question-subject-filter" htmlFor={subjectSelectId}>
              <span className="sb-label">Materia</span>
              <select
                id={subjectSelectId}
                className="sb-input sb-question-subject-select"
                onChange={(event) => setSubject(event.target.value)}
                value={subject}
              >
                <option value="">Tutte le materie</option>
                {data?.facets.subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
            </label>

            <div className="sb-question-status-filter">
              <span className="sb-label" id={statusLabelId}>
                Stato
              </span>
              <div className="sb-question-status-chips" aria-labelledby={statusLabelId}>
                {statusOptions.filter((item) => !fixedStatus || item.id === status).map((item) => {
                  const count = statusCountById.get(item.id);

                  return (
                    <button
                      aria-pressed={status === item.id}
                      className="sb-question-status-chip"
                      data-active={status === item.id}
                      disabled={fixedStatus}
                      key={item.id || "all"}
                      onClick={() => setStatus(item.id)}
                      type="button"
                    >
                      <span>{item.label}</span>
                      {count != null ? <span className="sb-question-status-count">{count}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {error ? (
        <EmptyState title="Ricerca non disponibile" description={error} />
      ) : !data && loading ? (
        <SectionCard>
          <p className="text-sm text-[var(--sb-text-dim)]">Caricamento indice...</p>
        </SectionCard>
      ) : data?.results.length === 0 ? (
        <EmptyState
          title="Nessuna domanda trovata"
          description="Prova un termine piu corto, un'altra materia o uno stato diverso."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--sb-text-dim)]">
            <span>{data ? `${data.results.length} risultati` : "Pronta"}</span>
            {loading ? <span>Aggiornamento...</span> : null}
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
                  Tentativi {result.userStats.attempts} · Errori {result.userStats.wrong} · Corrette{" "}
                  {result.userStats.correct}
                </span>
                <span>{result.source ?? result.reliabilityLabel}</span>
                <button
                  className="sb-button-secondary"
                  onClick={() => setSelectedResult({ id: result.id, href: result.href })}
                  type="button"
                >
                  Apri dettaglio
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <QuestionDetailDialog
        open={Boolean(selectedResult)}
        questionId={selectedResult?.id ?? null}
        studioHref={selectedResult?.href ?? null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedResult(null);
        }}
      />
    </div>
  );
}
