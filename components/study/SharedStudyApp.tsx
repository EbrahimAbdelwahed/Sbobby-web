"use client";

import { useEffect, useState } from "react";

import type { QuestionView, Rating, SharedStudyAssignment, SharedStudyState } from "@/lib/exam/types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

const ratings: Array<{ id: Rating; label: string }> = [
  { id: "wrong", label: "Sbagliata" },
  { id: "partial", label: "Parziale" },
  { id: "correct", label: "Corretta" },
  { id: "easy", label: "Facile" },
];

export function SharedStudyApp({ code }: { code: string }) {
  const [state, setState] = useState<SharedStudyState | null>(null);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const payload = await jsonFetch<{ state: SharedStudyState }>(`/api/shared-sessions/${code}`);
    setState(payload.state);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadState() {
      try {
        const payload = await jsonFetch<{ state: SharedStudyState }>(`/api/shared-sessions/${code}`);
        if (!cancelled) setState(payload.state);
      } catch {
        if (!cancelled) setMessage("Sessione non disponibile");
      }
    }
    void loadState();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const question = state?.questions[index] ?? null;
  const answered = state?.answers.some((answer) => answer.userId === state.currentUserId && answer.questionId === question?.id);

  async function rate(rating: Rating) {
    if (!question) return;
    await jsonFetch(`/api/shared-sessions/${code}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, rating }),
    });
    setShowAnswer(false);
    setIndex((value) => Math.min(value + 1, Math.max((state?.questions.length ?? 1) - 1, 0)));
    await load();
  }

  return (
    <main className="sb-page">
      <div className="sb-shell max-w-[1180px]">
        <header className="sb-header">
          <div>
            <p className="sb-kicker">Sessione condivisa</p>
            <h1 className="sb-title">{code}</h1>
            <p className="mt-2 text-sm text-[var(--sb-text-dim)]">{state?.participants.length ?? 0} partecipanti</p>
          </div>
          {state?.session.groupReviewEnabled ? (
            <a className="sb-button-secondary" href={`/study/shared/${code}/review`}>Review gruppo</a>
          ) : null}
        </header>
        {message ? <p className="text-sm text-rose-600">{message}</p> : null}
        {question ? (
          <QuestionPanel
            question={question}
            index={index}
            total={state?.questions.length ?? 0}
            showAnswer={showAnswer}
            answered={Boolean(answered)}
            onToggle={() => setShowAnswer((value) => !value)}
            onRate={rate}
          />
        ) : <p className="text-sm text-[var(--sb-text-dim)]">Caricamento...</p>}
      </div>
    </main>
  );
}

function QuestionPanel({
  question,
  index,
  total,
  showAnswer,
  answered,
  onToggle,
  onRate,
}: {
  question: QuestionView;
  index: number;
  total: number;
  showAnswer: boolean;
  answered: boolean;
  onToggle: () => void;
  onRate: (rating: Rating) => void;
}) {
  return (
    <article className="sb-panel overflow-hidden">
      <div className="border-b border-[var(--sb-border)] bg-[var(--sb-surface3)] px-5 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="sb-badge">{question.subjectLabel}</span>
        {answered ? <span className="sb-badge border-[#b7ddcf] bg-[#e6f5ef] text-[#176b5b]">Risposta inviata</span> : null}
        <span className="ml-auto text-sm font-semibold text-[var(--sb-text-dim)]">{index + 1} / {total}</span>
      </div>
      </div>
      <div className="p-5 md:p-7">
      <h2 className="max-w-5xl text-2xl font-semibold leading-snug text-[var(--sb-text)] md:text-[1.7rem]">{question.questionText}</h2>
      {question.options.length ? (
        <div className="mt-6 grid gap-3">
          {question.options.map((option) => (
            <div key={option.id} className="sb-option text-sm">
              <span className="sb-option-letter">{option.label}</span>
              <span className="pt-0.5 leading-6">{option.text}</span>
            </div>
          ))}
        </div>
      ) : null}
      <button className="sb-action-primary mt-6" onClick={onToggle}>
        {showAnswer ? "Nascondi risposta" : "Mostra risposta"}
      </button>
      {showAnswer && question.explanation ? (
        <div className="mt-6 border-t border-[var(--sb-border)] pt-6">
          <div className="sb-answer-box">
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--sb-accent)]">Risposta</h3>
            <p className="mt-2 text-base font-semibold leading-7 text-[var(--sb-text)]">{question.explanation.answer}</p>
            <h3 className="mt-5 text-sm font-bold uppercase tracking-[0.08em] text-[var(--sb-accent)]">Spiegazione</h3>
            <p className="mt-2 text-sm leading-6 text-[#40524d]">{question.explanation.explanationShort}</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {ratings.map((rating) => (
              <button key={rating.id} className="sb-button-secondary" onClick={() => onRate(rating.id)}>
                {rating.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      </div>
    </article>
  );
}

export function SharedReviewApp({ code }: { code: string }) {
  const [assignments, setAssignments] = useState<SharedStudyAssignment[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void jsonFetch<{ assignments: SharedStudyAssignment[] }>(`/api/shared-sessions/${code}/review`)
      .then((payload) => setAssignments(payload.assignments))
      .catch(() => setMessage("Review non disponibile"));
  }, [code]);

  return (
    <main className="sb-page">
      <div className="sb-shell max-w-[1180px]">
        <header className="border-b border-[var(--sb-border)] pb-5">
          <p className="sb-kicker">Review gruppo</p>
          <h1 className="sb-title">{code}</h1>
        </header>
        {message ? <p className="text-sm text-rose-600">{message}</p> : null}
        <div className="grid gap-4">
          {assignments.map((assignment) => (
            <article key={assignment.question.id} className="sb-panel p-5">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="sb-badge">{assignment.question.subjectLabel}</span>
                {assignment.assignedExplainers.length ? (
                  assignment.assignedExplainers.map((user) => <span key={user.userId} className="sb-badge border-[#b7ddcf] bg-[#e6f5ef] text-[#176b5b]">{user.displayName}</span>)
                ) : <span className="sb-badge">Nessun assegnatario</span>}
              </div>
              <h2 className="mt-4 text-lg font-semibold leading-7 text-[var(--sb-text)]">{assignment.question.questionText}</h2>
              <div className="sb-answer-box mt-3">
                <p className="text-sm font-semibold text-[var(--sb-text)]">{assignment.question.explanation?.answer}</p>
                <p className="mt-2 text-sm leading-6 text-[#40524d]">{assignment.question.explanation?.explanationShort}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
