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
    <main className="min-h-screen bg-[var(--sb-bg)] text-[var(--sb-text)]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-5 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--sb-border)] pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sb-accent)]">Sessione condivisa</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">{code}</h1>
            <p className="mt-2 text-sm text-slate-500">{state?.participants.length ?? 0} partecipanti</p>
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
        ) : <p className="text-sm text-slate-500">Caricamento...</p>}
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
    <article className="sb-panel p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="sb-badge">{question.subjectLabel}</span>
        {answered ? <span className="sb-badge border-emerald-200 bg-emerald-50 text-emerald-700">Risposta inviata</span> : null}
        <span className="ml-auto text-slate-500">{index + 1} / {total}</span>
      </div>
      <h2 className="mt-5 max-w-4xl text-2xl font-semibold leading-snug text-slate-950">{question.questionText}</h2>
      {question.options.length ? (
        <div className="mt-5 grid gap-2">
          {question.options.map((option) => (
            <div key={option.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <strong>{option.label}.</strong> {option.text}
            </div>
          ))}
        </div>
      ) : null}
      <button className="sb-button-primary mt-6" onClick={onToggle}>
        {showAnswer ? "Nascondi risposta" : "Mostra risposta"}
      </button>
      {showAnswer && question.explanation ? (
        <div className="mt-6 border-t border-slate-200 pt-6">
          <h3 className="font-semibold text-slate-950">Risposta</h3>
          <p className="mt-2 text-sm text-slate-800">{question.explanation.answer}</p>
          <h3 className="mt-5 font-semibold text-slate-950">Spiegazione</h3>
          <p className="mt-2 text-sm text-slate-600">{question.explanation.explanationShort}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {ratings.map((rating) => (
              <button key={rating.id} className="sb-button-secondary" onClick={() => onRate(rating.id)}>
                {rating.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
    <main className="min-h-screen bg-[var(--sb-bg)] text-[var(--sb-text)]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-5 md:px-8">
        <header className="border-b border-[var(--sb-border)] pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sb-accent)]">Review gruppo</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">{code}</h1>
        </header>
        {message ? <p className="text-sm text-rose-600">{message}</p> : null}
        <div className="grid gap-4">
          {assignments.map((assignment) => (
            <article key={assignment.question.id} className="sb-panel p-5">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="sb-badge">{assignment.question.subjectLabel}</span>
                {assignment.assignedExplainers.length ? (
                  assignment.assignedExplainers.map((user) => <span key={user.userId} className="sb-badge border-emerald-200 bg-emerald-50 text-emerald-700">{user.displayName}</span>)
                ) : <span className="sb-badge">Nessun assegnatario</span>}
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-950">{assignment.question.questionText}</h2>
              <p className="mt-3 text-sm text-slate-800">{assignment.question.explanation?.answer}</p>
              <p className="mt-2 text-sm text-slate-600">{assignment.question.explanation?.explanationShort}</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
