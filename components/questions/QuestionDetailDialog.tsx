"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import type { QuestionView } from "@/lib/exam/types";

type QuestionDetailDialogProps = {
  questionId: string | null;
  studioHref?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function statusLabel(value?: string) {
  if (value === "supported") return "Supportata";
  if (value === "externally_supported") return "Supportata da fonti esterne";
  if (value === "partially_supported") return "Parziale";
  if (value === "conflicting_sources") return "Fonti in conflitto";
  if (value === "insufficient_evidence") return "Evidenza insufficiente";
  return "Non disponibile";
}

export function QuestionDetailDialog({ questionId, studioHref, open, onOpenChange }: QuestionDetailDialogProps) {
  const [question, setQuestion] = useState<QuestionView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descriptionId = useId();

  useEffect(() => {
    if (!open || !questionId) return;

    const controller = new AbortController();
    window.queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      setQuestion(null);
    });

    void fetch(`/api/questions?question=${encodeURIComponent(questionId)}&limit=1`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Dettaglio non disponibile (${response.status})`);
        const payload = (await response.json()) as { questions: QuestionView[] };
        const [first] = payload.questions;
        if (!first) throw new Error("Domanda non trovata o non pubblicata.");
        setQuestion(first);
      })
      .catch((detailError) => {
        if (!controller.signal.aborted) {
          setError(detailError instanceof Error ? detailError.message : "Dettaglio non disponibile");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, questionId]);

  const explanation = question?.explanation;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sb-dialog-overlay" />
        <Dialog.Content className="sb-question-dialog">
          <div className="sb-question-dialog-header">
            <div>
              <Dialog.Title className="sb-question-dialog-title">Dettaglio domanda</Dialog.Title>
              <Dialog.Description className="sb-question-dialog-description" id={descriptionId}>
                Lettura completa della domanda pubblicata, con risposta, fonti e stato personale.
              </Dialog.Description>
            </div>
            <Dialog.Close className="sb-dialog-close" aria-label="Chiudi dettaglio">
              <span aria-hidden="true">×</span>
            </Dialog.Close>
          </div>

          <div className="sb-question-dialog-body" aria-describedby={descriptionId}>
            {loading ? <p className="text-sm text-[var(--sb-text-dim)]">Caricamento dettaglio...</p> : null}
            {error ? <p className="text-sm font-medium text-[var(--sb-red)]">{error}</p> : null}

            {question ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="sb-badge">{question.subjectLabel}</span>
                  <span className="sb-chip">{question.reliabilityLevel.label}</span>
                  <span className="sb-chip">{question.reviewStatus.label}</span>
                  {explanation ? <span className="sb-chip">Evidenza: {statusLabel(explanation.evidenceStatus)}</span> : null}
                </div>

                <section>
                  <h3 className="sb-question-detail-heading">Domanda</h3>
                  <p className="sb-question-detail-text">{question.questionText}</p>
                </section>

                {question.options.length ? (
                  <section>
                    <h3 className="sb-question-detail-heading">Opzioni</h3>
                    <div className="space-y-2">
                      {question.options.map((option) => (
                        <div className="sb-question-detail-option" key={option.id}>
                          <strong>{option.label}</strong>
                          <span>{option.text}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {explanation ? (
                  <section className="sb-question-detail-answer">
                    <h3 className="sb-question-detail-heading">Risposta</h3>
                    <p className="font-semibold text-[var(--sb-text)]">{explanation.answer}</p>
                    {explanation.explanationShort ? <p>{explanation.explanationShort}</p> : null}
                    {explanation.rationale ? <p>{explanation.rationale}</p> : null}
                    {explanation.warnings.length ? (
                      <p className="text-sm text-[var(--sb-yellow)]">Note: {explanation.warnings.join("; ")}</p>
                    ) : null}
                  </section>
                ) : null}

                <section>
                  <h3 className="sb-question-detail-heading">Argomenti e stato</h3>
                  <div className="sb-question-detail-grid">
                    <DetailItem label="Argomenti" value={question.topics.map((topic) => topic.title).join(", ") || "Non associati"} />
                    <DetailItem label="Moduli" value={Array.from(new Set(question.topics.map((topic) => topic.moduleTitle))).join(", ") || "Non associati"} />
                    <DetailItem label="Revisione" value={question.reviewStatus.label} />
                    <DetailItem label="Affidabilita" value={question.reliabilityLevel.label} />
                    <DetailItem label="Segnalazioni aperte" value={String(question.reportCount ?? 0)} />
                    <DetailItem
                      label="Statistiche personali"
                      value={`Tentativi ${question.userStats.attempts} · Errori ${question.userStats.wrong} · Corrette ${question.userStats.correct}`}
                    />
                  </div>
                </section>

                <section>
                  <h3 className="sb-question-detail-heading">Fonti</h3>
                  <div className="space-y-3">
                    {question.sourceRefs.length ? (
                      <div className="sb-question-source-card">
                        <strong>Riferimenti</strong>
                        <p>{question.sourceRefs.map((ref) => `${ref.path}${ref.section ? `, ${ref.section}` : ""}`).join(" · ")}</p>
                      </div>
                    ) : null}
                    {question.sourceChunks.slice(0, 4).map((chunk) => (
                      <div className="sb-question-source-card" key={chunk.id}>
                        <strong>{chunk.sourceTitle || chunk.sourcePath}</strong>
                        <p className="text-xs text-[var(--sb-text-dim)]">
                          {[chunk.professor, chunk.year, chunk.headingPath.join(" / ")].filter(Boolean).join(" · ")}
                        </p>
                        <p>{chunk.textClean}</p>
                      </div>
                    ))}
                    {!question.sourceRefs.length && !question.sourceChunks.length ? (
                      <p className="text-sm text-[var(--sb-text-dim)]">Nessuna fonte visualizzabile per questa domanda.</p>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}
          </div>

          <div className="sb-question-dialog-footer">
            {studioHref ? (
              <Link className="sb-button-secondary" href={studioHref}>
                Apri in Studio
              </Link>
            ) : null}
            <Dialog.Close className="sb-action-primary">Chiudi</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="sb-question-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
