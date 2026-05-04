"use client";

/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

import type {
  QuestionView,
  Rating,
  ReliabilityLevel,
  ReviewStatus,
  Subject,
  Topic,
} from "@/lib/exam/types";

type User = { id: string; email: string } | null;
type TopicOption = Topic & { moduleTitle: string };
type TopicStat = {
  id: string;
  title: string;
  subject: string;
  moduleTitle: string;
  attempts: number;
  wrong: number;
  correct: number;
};
type QuestionStat = {
  id: string;
  questionText: string;
  subject: string;
  attempts: number;
  wrong: number;
  correct: number;
  lastRating: Rating | null;
};

const ratings: Array<{ id: Rating; label: string }> = [
  { id: "wrong", label: "Sbagliata" },
  { id: "partial", label: "Parziale" },
  { id: "correct", label: "Corretta" },
  { id: "easy", label: "Facile" },
];

function tokenClass(token: string) {
  if (token === "success") return "border-[var(--sb-green)] text-[var(--sb-green)]";
  if (token === "warning") return "border-[var(--sb-yellow)] text-[var(--sb-yellow)]";
  if (token === "info") return "border-sky-400 text-sky-300";
  return "border-[var(--sb-border)] text-[var(--sb-text-dim)]";
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export function ExamStudioApp() {
  const [user, setUser] = useState<User>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [reliabilityLevels, setReliabilityLevels] = useState<ReliabilityLevel[]>([]);
  const [reviewStatuses, setReviewStatuses] = useState<ReviewStatus[]>([]);
  const [questions, setQuestions] = useState<QuestionView[]>([]);
  const [reviewQueue, setReviewQueue] = useState<QuestionView[]>([]);
  const [topicStats, setTopicStats] = useState<TopicStat[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([]);
  const [tab, setTab] = useState<"study" | "stats" | "review">("study");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [reliability, setReliability] = useState("");
  const [wrongBefore, setWrongBefore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex] ?? null;
  const selectedSubjectTopics = useMemo(
    () => topics.filter((item) => !subject || item.subject === subject),
    [subject, topics],
  );

  async function loadBase() {
    setLoading(true);
    const [me, subjectsPayload, topicsPayload, reliabilityPayload, statusesPayload] = await Promise.all([
      jsonFetch<{ user: User }>("/api/auth/me"),
      jsonFetch<{ subjects: Subject[] }>("/api/subjects"),
      jsonFetch<{ topics: TopicOption[] }>("/api/topics"),
      jsonFetch<{ reliabilityLevels: ReliabilityLevel[] }>("/api/reliability-levels"),
      jsonFetch<{ reviewStatuses: ReviewStatus[] }>("/api/review-statuses"),
    ]);
    setUser(me.user);
    setSubjects(subjectsPayload.subjects);
    setTopics(topicsPayload.topics);
    setReliabilityLevels(reliabilityPayload.reliabilityLevels);
    setReviewStatuses(statusesPayload.reviewStatuses);
    setLoading(false);
    if (!me.user) {
      window.location.href = "/login";
    }
  }

  async function loadQuestions() {
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (topic) params.set("topic", topic);
    if (reliability) params.set("reliability", reliability);
    if (wrongBefore) params.set("wrongBefore", "true");
    const payload = await jsonFetch<{ questions: QuestionView[] }>(`/api/questions?${params}`);
    setQuestions(payload.questions);
    setCurrentIndex(0);
    setShowAnswer(false);
  }

  async function loadReviewQueue() {
    const payload = await jsonFetch<{ questions: QuestionView[] }>("/api/admin/review-queue");
    setReviewQueue(payload.questions);
  }

  async function loadStats() {
    const [topicPayload, questionPayload] = await Promise.all([
      jsonFetch<{ topics: TopicStat[] }>("/api/stats/topics"),
      jsonFetch<{ questions: QuestionStat[] }>("/api/stats/questions"),
    ]);
    setTopicStats(topicPayload.topics);
    setQuestionStats(questionPayload.questions);
  }

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    if (!loading) {
      void loadQuestions();
      void loadReviewQueue();
      void loadStats();
    }
  }, [loading, subject, topic, reliability, wrongBefore]);

  async function startSession() {
    const payload = await jsonFetch<{ session: { id: string } }>("/api/study-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters: { subject, topic, reliability, wrongBefore } }),
    });
    setSessionId(payload.session.id);
    setMessage("Sessione avviata");
  }

  async function submitRating(rating: Rating) {
    if (!currentQuestion) return;
    await jsonFetch("/api/review-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: currentQuestion.id, sessionId, rating }),
    });
    setShowAnswer(false);
    setCurrentIndex((index) => Math.min(index + 1, Math.max(questions.length - 1, 0)));
    await loadStats();
  }

  async function approveQuestion(question: QuestionView) {
    await jsonFetch(`/api/admin/questions/${question.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewStatusId: "approved",
        reliabilityLevelId: "human_verified",
      }),
    });
    setMessage("Card approvata e pubblicabile");
    await Promise.all([loadReviewQueue(), loadQuestions()]);
  }

  async function logout() {
    await signOut({ callbackUrl: "/login" });
  }

  if (loading) {
    return <main className="min-h-screen px-5 py-6 text-sm text-[var(--sb-text-dim)]">Caricamento...</main>;
  }

  return (
    <main className="min-h-screen px-4 py-5 md:px-8">
      <header className="mx-auto flex max-w-7xl flex-col gap-4 border-b border-[var(--sb-border)] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.12em] text-[var(--sb-text-dim)]">Sbobby</p>
          <h1 className="mt-1 text-3xl font-semibold">Exam flashcards</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--sb-text-dim)]">
          <span>{user?.email ?? "Sessione locale"}</span>
          <button className="rounded-md border border-[var(--sb-border)] px-3 py-2" onClick={logout}>
            Esci
          </button>
        </div>
      </header>

      <section className="mx-auto mt-5 max-w-7xl">
        <div className="flex flex-wrap gap-2">
          {(["study", "stats", "review"] as const).map((item) => (
            <button
              key={item}
              className={`rounded-md border px-3 py-2 text-sm ${
                tab === item
                  ? "border-[var(--sb-accent)] bg-[var(--sb-surface2)]"
                  : "border-[var(--sb-border)]"
              }`}
              onClick={() => setTab(item)}
            >
              {item === "study" ? "Studio" : item === "stats" ? "Statistiche" : "Review"}
            </button>
          ))}
        </div>
        {message ? <p className="mt-3 text-sm text-[var(--sb-green)]">{message}</p> : null}
      </section>

      {tab === "study" ? (
        <section className="mx-auto mt-5 grid max-w-7xl gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
            <h2 className="text-lg font-semibold">Filtri</h2>
            <label className="mt-4 block text-sm text-[var(--sb-text-dim)]">Materia</label>
            <select className="mt-1 w-full rounded-md border border-[var(--sb-border)] bg-[var(--sb-bg)] p-2 text-sm" value={subject} onChange={(event) => { setSubject(event.target.value); setTopic(""); }}>
              <option value="">Tutte</option>
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <label className="mt-4 block text-sm text-[var(--sb-text-dim)]">Argomento</label>
            <select className="mt-1 w-full rounded-md border border-[var(--sb-border)] bg-[var(--sb-bg)] p-2 text-sm" value={topic} onChange={(event) => setTopic(event.target.value)}>
              <option value="">Tutti</option>
              {selectedSubjectTopics.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
            <label className="mt-4 block text-sm text-[var(--sb-text-dim)]">Affidabilita</label>
            <select className="mt-1 w-full rounded-md border border-[var(--sb-border)] bg-[var(--sb-bg)] p-2 text-sm" value={reliability} onChange={(event) => setReliability(event.target.value)}>
              <option value="">Tutte pubblicabili</option>
              {reliabilityLevels.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input checked={wrongBefore} onChange={(event) => setWrongBefore(event.target.checked)} type="checkbox" />
              Sbagliate in precedenza
            </label>
            <button className="mt-5 w-full rounded-md bg-[var(--sb-accent)] px-3 py-2 text-sm font-semibold text-white" onClick={startSession}>
              Avvia sessione
            </button>
          </aside>

          <section className="min-h-[540px]">
            {questions.length === 0 ? (
              <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-6">
                <h2 className="text-xl font-semibold">Nessuna card pubblicabile</h2>
                <p className="mt-2 text-sm text-[var(--sb-text-dim)]">
                  Il seed importato resta in review. Approva alcune card nella vista Review per renderle studiabili.
                </p>
              </div>
            ) : currentQuestion ? (
              <article className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded border border-[var(--sb-border)] px-2 py-1">{currentQuestion.subjectLabel}</span>
                  <span className={`rounded border px-2 py-1 ${tokenClass(currentQuestion.reliabilityLevel.colorToken)}`}>{currentQuestion.reliabilityLevel.label}</span>
                  <span className="text-[var(--sb-text-dim)]">{currentIndex + 1} / {questions.length}</span>
                </div>
                <h2 className="mt-5 text-2xl font-semibold leading-snug">{currentQuestion.questionText}</h2>
                {currentQuestion.options.length ? (
                  <div className="mt-5 grid gap-2">
                    {currentQuestion.options.map((option) => (
                      <div key={option.id} className="rounded-md border border-[var(--sb-border)] bg-[var(--sb-bg)] px-3 py-2 text-sm">
                        <strong>{option.label}.</strong> {option.text}
                      </div>
                    ))}
                  </div>
                ) : null}
                <button className="mt-6 rounded-md border border-[var(--sb-accent)] px-3 py-2 text-sm font-semibold" onClick={() => setShowAnswer((value) => !value)}>
                  {showAnswer ? "Nascondi risposta" : "Mostra risposta"}
                </button>
                {showAnswer && currentQuestion.explanation ? (
                  <div className="mt-5 border-t border-[var(--sb-border)] pt-5">
                    <h3 className="font-semibold">Risposta</h3>
                    <p className="mt-2 text-sm">{currentQuestion.explanation.answer}</p>
                    <h3 className="mt-4 font-semibold">Spiegazione</h3>
                    <p className="mt-2 text-sm text-[var(--sb-text-dim)]">{currentQuestion.explanation.explanationShort}</p>
                    <div className="mt-4 grid gap-3">
                      {currentQuestion.sourceChunks.slice(0, 2).map((chunk) => (
                        <details key={chunk.id} className="rounded-md border border-[var(--sb-border)] bg-[var(--sb-bg)] p-3 text-sm">
                          <summary className="cursor-pointer font-medium">{chunk.sourceTitle}</summary>
                          <p className="mt-2 text-[var(--sb-text-dim)]">{chunk.textClean.slice(0, 700)}</p>
                        </details>
                      ))}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {ratings.map((rating) => (
                        <button key={rating.id} className="rounded-md border border-[var(--sb-border)] px-3 py-2 text-sm" onClick={() => submitRating(rating.id)}>
                          {rating.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ) : null}
          </section>
        </section>
      ) : null}

      {tab === "stats" ? (
        <section className="mx-auto mt-5 grid max-w-7xl gap-5 lg:grid-cols-2">
          <StatsList title="Argomenti problematici" rows={topicStats.map((item) => ({ id: item.id, title: item.title, meta: `${item.moduleTitle} · ${item.wrong}/${item.attempts} errori` }))} />
          <StatsList title="Domande problematiche" rows={questionStats.map((item) => ({ id: item.id, title: item.questionText, meta: `${item.subject} · ${item.wrong}/${item.attempts} errori` }))} />
        </section>
      ) : null}

      {tab === "review" ? (
        <section className="mx-auto mt-5 max-w-7xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">Coda review</h2>
              <p className="text-sm text-[var(--sb-text-dim)]">{reviewQueue.length} card da controllare</p>
            </div>
            <div className="text-sm text-[var(--sb-text-dim)]">
              Stati DB: {reviewStatuses.map((item) => item.label).join(", ")}
            </div>
          </div>
          <div className="grid gap-3">
            {reviewQueue.slice(0, 24).map((question) => (
              <article key={question.id} className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded border border-[var(--sb-border)] px-2 py-1">{question.subjectLabel}</span>
                  <span className="rounded border border-[var(--sb-border)] px-2 py-1">{question.reviewStatus.label}</span>
                  <span className={`rounded border px-2 py-1 ${tokenClass(question.reliabilityLevel.colorToken)}`}>{question.reliabilityLevel.label}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold">{question.questionText}</h3>
                <p className="mt-2 text-sm text-[var(--sb-text-dim)]">{question.explanation?.explanationShort}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {question.sourceChunks.slice(0, 2).map((chunk) => (
                    <div key={chunk.id} className="rounded-md border border-[var(--sb-border)] bg-[var(--sb-bg)] p-3 text-sm text-[var(--sb-text-dim)]">
                      <p className="mb-2 font-medium text-[var(--sb-text)]">{chunk.sourceTitle}</p>
                      {chunk.textClean.slice(0, 420)}
                    </div>
                  ))}
                </div>
                <button className="mt-4 rounded-md bg-[var(--sb-green)] px-3 py-2 text-sm font-semibold text-black" onClick={() => approveQuestion(question)}>
                  Approva
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function StatsList({ title, rows }: { title: string; rows: Array<{ id: string; title: string; meta: string }> }) {
  return (
    <section className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 grid gap-2">
        {rows.length ? rows.map((row) => (
          <div key={row.id} className="rounded-md border border-[var(--sb-border)] bg-[var(--sb-bg)] p-3">
            <p className="line-clamp-2 text-sm font-medium">{row.title}</p>
            <p className="mt-1 text-xs text-[var(--sb-text-dim)]">{row.meta}</p>
          </div>
        )) : <p className="text-sm text-[var(--sb-text-dim)]">Nessun evento registrato.</p>}
      </div>
    </section>
  );
}
