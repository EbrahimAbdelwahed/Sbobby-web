"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
        if (!response.ok) throw new Error(`Ricerca non riuscita (${response.status})`);
        setData((await response.json()) as SearchResponse);
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
      <SectionCard>
        <div className="sb-search-controls">
          <label className="sb-search-input-wrap">
            <span className="sb-label">Cerca nelle domande</span>
            <input
              className="sb-input sb-search-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Domande, risposte, spiegazioni, argomenti, fonti"
              type="search"
              value={query}
            />
          </label>
          <label>
            <span className="sb-label">Materia</span>
            <select className="sb-input" onChange={(event) => setSubject(event.target.value)} value={subject}>
              <option value="">Tutte le materie</option>
              {data?.facets.subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="sb-label">Stato</span>
            <div className="sb-filter-segments" aria-label="Filtro stato">
              {statusOptions.filter((item) => !fixedStatus || item.id === status).map((item) => (
                <button
                  className="sb-filter-segment"
                  data-active={status === item.id}
                  disabled={fixedStatus}
                  key={item.id || "all"}
                  onClick={() => setStatus(item.id)}
                  type="button"
                >
                  {item.label}
                  {data?.facets.statuses.find((facet) => facet.id === item.id)?.count != null ? (
                    <span>{data.facets.statuses.find((facet) => facet.id === item.id)?.count}</span>
                  ) : null}
                </button>
              ))}
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
                <Link className="sb-button-secondary" href={result.href}>
                  Apri in Studio
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
