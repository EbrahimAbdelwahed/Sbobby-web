"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  CardReportReason,
  QuestionOption,
  QuestionView,
  Rating,
  StudySession,
  Subject,
  TopicClusterStat,
  TopicProgressStat,
  TopicWithModule,
} from "@/lib/exam/types";

type Theme = "light" | "dark";
type Phase = "loading" | "login" | "setup" | "quiz" | "complete";
type TopicMode = "all" | "manual" | "random";

type BootstrapPayload = {
  user: { email?: string; name?: string | null } | null;
  subjects: Subject[];
  topics: TopicWithModule[];
};

type TopicStatsPayload = {
  topics: TopicProgressStat[];
  clusters: TopicClusterStat[];
};

type StudyFilters = {
  subject: string;
  topicMode: TopicMode;
  topics: string[];
  randomTopicCount: number;
  limit: number;
};

type AnswerState = {
  selectedOptionId: string;
  correctOptionId: string | null;
  isCorrect: boolean | null;
  recorded: boolean;
};

type SessionSummary = {
  answered: number;
  correct: number;
  wrong: number;
  skipped: number;
};

const questionCountOptions = [5, 10, 20, 30];
const randomTopicCountOptions = [2, 3, 5];

const reportReasons: Array<{ id: CardReportReason; label: string }> = [
  { id: "formatting_text", label: "Testo o formattazione" },
  { id: "wrong_answer", label: "Risposta errata" },
  { id: "wrong_exam_program", label: "Fuori programma" },
];

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function correctOptionIdFor(question: QuestionView) {
  const answer = question.explanation?.answer.trim().toUpperCase();
  if (!answer) return null;
  const normalizedAnswer = answer.replace(/^[\s(["']+|[\s).,"']+$/g, "");
  const exact = question.options.find((option) => option.label.trim().toUpperCase() === normalizedAnswer);
  if (exact) return exact.id;
  const prefixed = question.options.find((option) => normalizedAnswer.startsWith(`${option.label.trim().toUpperCase()}.`));
  return prefixed?.id ?? null;
}

function topicLabel(topic?: TopicWithModule) {
  if (!topic) return "Tutti gli argomenti";
  const path = topic.path.length ? topic.path.join(" / ") : topic.title;
  return `${topic.moduleTitle} - ${path}`;
}

function topicSelectionLabel(topicIds: string[], topics: TopicWithModule[]) {
  if (!topicIds.length) return "Tutti gli argomenti";
  if (topicIds.length === 1) return topicLabel(topics.find((topic) => topic.id === topicIds[0]));
  return `${topicIds.length} argomenti selezionati`;
}

function shuffleTopics(items: TopicWithModule[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("sb-mobile-study-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function MobileStudyApp() {
  const [theme, setTheme] = useState<Theme>(() => initialTheme());
  const [phase, setPhase] = useState<Phase>("loading");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<TopicWithModule[]>([]);
  const [topicStats, setTopicStats] = useState<TopicProgressStat[]>([]);
  const [topicClusters, setTopicClusters] = useState<TopicClusterStat[]>([]);
  const [filters, setFilters] = useState<StudyFilters>({
    subject: "",
    topicMode: "all",
    topics: [],
    randomTopicCount: 3,
    limit: 10,
  });
  const [questions, setQuestions] = useState<QuestionView[]>([]);
  const [session, setSession] = useState<StudySession | null>(null);
  const [index, setIndex] = useState(0);
  const [answerState, setAnswerState] = useState<AnswerState | null>(null);
  const [summary, setSummary] = useState<SessionSummary>({ answered: 0, correct: 0, wrong: 0, skipped: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("sb-mobile-study-theme", theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    jsonFetch<BootstrapPayload>("/api/bootstrap")
      .then((payload) => {
        if (!active) return;
        if (!payload.user) {
          setPhase("login");
          return;
        }
        setSubjects(payload.subjects);
        setTopics(payload.topics);
        void jsonFetch<TopicStatsPayload>("/api/stats/topics")
          .then((statsPayload) => {
            if (!active) return;
            setTopicStats(statsPayload.topics);
            setTopicClusters(statsPayload.clusters);
          })
          .catch(() => {
            if (!active) return;
            setTopicStats([]);
            setTopicClusters([]);
          });
        const firstSubject = payload.subjects[0]?.id ?? "";
        setFilters((current) => ({ ...current, subject: firstSubject }));
        setPhase("setup");
      })
      .catch((fetchError) => {
        if (!active) return;
        setError(fetchError instanceof Error ? fetchError.message : "Impossibile caricare Sbobby.");
        setPhase("setup");
      });
    return () => {
      active = false;
    };
  }, []);

  const subjectTopics = useMemo(
    () => topics.filter((topic) => !filters.subject || topic.subject === filters.subject),
    [filters.subject, topics],
  );
  const eligibleSubjectTopics = useMemo(
    () => subjectTopics.filter((topic) => topic.questionCount > 0),
    [subjectTopics],
  );
  const selectedSubject = subjects.find((subject) => subject.id === filters.subject);
  const currentQuestion = questions[index];

  function updateTheme(nextTheme: Theme) {
    setTheme(nextTheme);
  }

  function updateSubject(subject: string) {
    setFilters((current) => ({ ...current, subject, topicMode: "all", topics: [] }));
  }

  async function startSession(nextFilters = filters) {
    if (!nextFilters.subject) {
      setError("Scegli una materia prima di iniziare.");
      return;
    }
    const topicsForRequest = (() => {
      if (nextFilters.topicMode === "all") return [];
      if (nextFilters.topicMode === "manual") return nextFilters.topics;
      return shuffleTopics(eligibleSubjectTopics)
        .slice(0, Math.max(1, nextFilters.randomTopicCount))
        .map((topic) => topic.id);
    })();
    if (nextFilters.topicMode !== "all" && topicsForRequest.length === 0) {
      setError("Scegli almeno un argomento con domande pubblicate.");
      return;
    }
    const resolvedFilters: StudyFilters = {
      ...nextFilters,
      topics: topicsForRequest,
    };
    setBusy(true);
    setError(null);
    try {
      const sessionPayload = await jsonFetch<{ session: StudySession }>("/api/study-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            subject: resolvedFilters.subject,
            topics: topicsForRequest,
            limit: resolvedFilters.limit,
            order: "unseen_first",
          },
        }),
      });
      const params = new URLSearchParams({
        subject: resolvedFilters.subject,
        limit: String(resolvedFilters.limit),
        order: "unseen_first",
      });
      topicsForRequest.forEach((topicId) => params.append("topic", topicId));
      const questionPayload = await jsonFetch<{ questions: QuestionView[] }>(`/api/questions?${params.toString()}`);
      if (!questionPayload.questions.length) {
        setError("Nessuna domanda trovata con questi filtri.");
        return;
      }
      setSession(sessionPayload.session);
      setQuestions(questionPayload.questions);
      setIndex(0);
      setAnswerState(null);
      setSummary({ answered: 0, correct: 0, wrong: 0, skipped: 0 });
      setFilters(resolvedFilters);
      setPhase("quiz");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Sessione non avviata.");
    } finally {
      setBusy(false);
    }
  }

  async function selectAnswer(option: QuestionOption) {
    if (!currentQuestion || answerState) return;
    const correctOptionId = correctOptionIdFor(currentQuestion);
    const isCorrect = correctOptionId ? option.id === correctOptionId : null;
    setAnswerState({ selectedOptionId: option.id, correctOptionId, isCorrect, recorded: false });
    setSummary((current) => ({
      answered: current.answered + 1,
      correct: isCorrect ? current.correct + 1 : current.correct,
      wrong: isCorrect === false ? current.wrong + 1 : current.wrong,
      skipped: current.skipped,
    }));
    if (!correctOptionId || !session) return;
    const rating: Rating = isCorrect ? "correct" : "wrong";
    try {
      await jsonFetch("/api/review-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: currentQuestion.id, sessionId: session.id, rating }),
      });
      setAnswerState((current) => (current ? { ...current, recorded: true } : current));
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Risposta mostrata, ma evento non registrato.");
    }
  }

  function sessionSnapshot(reason: "completed" | "ended_early", nextSummary = summary, nextIndex = index) {
    return {
      reason,
      currentIndex: nextIndex,
      currentQuestionId: questions[nextIndex]?.id ?? null,
      totalQuestions: questions.length,
      questionIds: questions.map((question) => question.id),
      summary: nextSummary,
      filters,
    };
  }

  async function saveSessionState(reason: "completed" | "ended_early", nextSummary = summary, nextIndex = index) {
    if (!session) {
      throw new Error("Sessione non disponibile.");
    }
    await jsonFetch<{ session: StudySession }>(`/api/study-sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: sessionSnapshot(reason, nextSummary, nextIndex) }),
    });
  }

  async function finishSession(reason: "completed" | "ended_early", nextSummary = summary, nextIndex = index) {
    setBusy(true);
    setError(null);
    try {
      await saveSessionState(reason, nextSummary, nextIndex);
      setPhase("complete");
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Stato della sessione non salvato.");
    } finally {
      setBusy(false);
    }
  }

  async function moveNext(kind: "next" | "skip") {
    const nextSummary = kind === "skip"
      ? { ...summary, skipped: summary.skipped + 1 }
      : summary;
    if (kind === "skip") {
      setSummary(nextSummary);
    }
    setError(null);
    setAnswerState(null);
    if (index + 1 >= questions.length) {
      await finishSession("completed", nextSummary, index);
      return;
    }
    setIndex((current) => current + 1);
  }

  function resetToSetup() {
    setQuestions([]);
    setSession(null);
    setIndex(0);
    setAnswerState(null);
    setSummary({ answered: 0, correct: 0, wrong: 0, skipped: 0 });
    setError(null);
    setPhase("setup");
  }

  return (
    <main className="sb-mobile-study-root" data-theme={theme}>
      <div className="sb-mobile-study-shell">
        <MobileHeader theme={theme} onThemeChange={updateTheme} />
        {error ? <p className="sb-mobile-study-alert">{error}</p> : null}
        {phase === "loading" ? <LoadingPanel /> : null}
        {phase === "login" ? <LoginPanel /> : null}
        {phase === "setup" ? (
          <>
            <SetupPanel
              busy={busy}
              filters={filters}
              subjects={subjects}
              topics={subjectTopics}
              eligibleTopicCount={eligibleSubjectTopics.length}
              onFiltersChange={setFilters}
              onSubjectChange={updateSubject}
              onStart={() => void startSession()}
            />
            <MobileStatsPanel
              clusters={topicClusters}
              subject={filters.subject}
              subjectName={selectedSubject?.name}
              topics={topicStats}
            />
          </>
        ) : null}
        {phase === "quiz" && currentQuestion ? (
          <QuizPanel
            answerState={answerState}
            busy={busy}
            index={index}
            question={currentQuestion}
            selectedSubject={selectedSubject}
            selectedTopicLabel={topicSelectionLabel(filters.topics, topics)}
            theme={theme}
            total={questions.length}
            onFinish={() => void finishSession("ended_early")}
            onNext={() => void moveNext("next")}
            onSelectAnswer={(option) => void selectAnswer(option)}
            onSkip={() => void moveNext("skip")}
          />
        ) : null}
        {phase === "complete" ? (
          <CompletionPanel
            filters={filters}
            selectedSubject={selectedSubject}
            selectedTopicLabel={topicSelectionLabel(filters.topics, topics)}
            summary={summary}
            total={questions.length}
            busy={busy}
            onNew={resetToSetup}
            onRepeat={() => void startSession(filters)}
          />
        ) : null}
      </div>
    </main>
  );
}

function MobileHeader({
  theme,
  onThemeChange,
}: {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}) {
  return (
    <header className="sb-mobile-study-topbar">
      <div>
        <p className="sb-mobile-study-kicker">Sbobby</p>
        <h1>Studio mobile</h1>
      </div>
      <div className="sb-mobile-study-theme-toggle" aria-label="Tema">
        <button type="button" data-active={theme === "light"} onClick={() => onThemeChange("light")}>
          Chiaro
        </button>
        <button type="button" data-active={theme === "dark"} onClick={() => onThemeChange("dark")}>
          Scuro
        </button>
      </div>
    </header>
  );
}

function LoadingPanel() {
  return (
    <section className="sb-mobile-study-panel">
      <p className="sb-mobile-study-muted">Caricamento dati di studio...</p>
    </section>
  );
}

function LoginPanel() {
  return (
    <section className="sb-mobile-study-panel sb-mobile-study-empty">
      <h2>Accesso richiesto</h2>
      <p>Entra con il tuo account per iniziare una sessione mobile.</p>
      <Link className="sb-mobile-study-primary" href="/login">
        Vai al login
      </Link>
    </section>
  );
}

function SetupPanel({
  busy,
  eligibleTopicCount,
  filters,
  subjects,
  topics,
  onFiltersChange,
  onSubjectChange,
  onStart,
}: {
  busy: boolean;
  eligibleTopicCount: number;
  filters: StudyFilters;
  subjects: Subject[];
  topics: TopicWithModule[];
  onFiltersChange: (filters: StudyFilters) => void;
  onSubjectChange: (subject: string) => void;
  onStart: () => void;
}) {
  const eligibleTopics = topics.filter((topic) => topic.questionCount > 0);

  function updateTopicMode(topicMode: TopicMode) {
    onFiltersChange({
      ...filters,
      topicMode,
      topics: topicMode === "manual" ? filters.topics : [],
    });
  }

  function toggleTopic(topicId: string) {
    const nextTopics = filters.topics.includes(topicId)
      ? filters.topics.filter((id) => id !== topicId)
      : [...filters.topics, topicId];
    onFiltersChange({ ...filters, topics: nextTopics });
  }

  return (
    <section className="sb-mobile-study-panel">
      <div className="sb-mobile-study-section-head">
        <p className="sb-mobile-study-kicker">Setup</p>
        <h2>Prepara la sessione</h2>
      </div>
      <div className="sb-mobile-study-form">
        <label>
          <span>Materia</span>
          <select value={filters.subject} onChange={(event) => onSubjectChange(event.target.value)}>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
        <div className="sb-mobile-study-field">
          <span>Argomenti</span>
          <div className="sb-mobile-study-mode-grid" role="group" aria-label="Modalita argomenti">
            <button
              type="button"
              data-active={filters.topicMode === "all"}
              onClick={() => updateTopicMode("all")}
            >
              Tutti
            </button>
            <button
              type="button"
              data-active={filters.topicMode === "manual"}
              onClick={() => updateTopicMode("manual")}
            >
              Manuale
            </button>
            <button
              type="button"
              data-active={filters.topicMode === "random"}
              onClick={() => updateTopicMode("random")}
            >
              Casuali
            </button>
          </div>
        </div>
        {filters.topicMode === "manual" ? (
          <div className="sb-mobile-study-topic-list" role="group" aria-label="Scegli argomenti">
            {eligibleTopics.length ? (
              eligibleTopics.map((topic) => (
                <label key={topic.id} className="sb-mobile-study-topic-choice">
                  <input
                    type="checkbox"
                    checked={filters.topics.includes(topic.id)}
                    onChange={() => toggleTopic(topic.id)}
                  />
                  <span>
                    <strong>{topicLabel(topic)}</strong>
                    <small>{topic.questionCount} domande</small>
                  </span>
                </label>
              ))
            ) : (
              <p className="sb-mobile-study-muted">Nessun argomento con domande pubblicate.</p>
            )}
          </div>
        ) : null}
        {filters.topicMode === "random" ? (
          <div className="sb-mobile-study-field">
            <span>Argomenti casuali</span>
            <div className="sb-mobile-study-counts" role="group" aria-label="Numero di argomenti casuali">
              {randomTopicCountOptions.map((count) => (
                <button
                  key={count}
                  type="button"
                  data-active={filters.randomTopicCount === count}
                  disabled={eligibleTopicCount === 0}
                  onClick={() => onFiltersChange({ ...filters, randomTopicCount: count })}
                >
                  {count}
                </button>
              ))}
            </div>
            <p className="sb-mobile-study-helper">
              Disponibili: {eligibleTopicCount}. La sessione salvera gli argomenti estratti.
            </p>
          </div>
        ) : null}
        <div className="sb-mobile-study-field">
          <span>Domande</span>
          <div className="sb-mobile-study-counts" role="group" aria-label="Numero di domande">
            {questionCountOptions.map((count) => (
              <button
                key={count}
                type="button"
                data-active={filters.limit === count}
                onClick={() => onFiltersChange({ ...filters, limit: count })}
              >
                {count}
              </button>
            ))}
          </div>
          <p className="sb-mobile-study-helper">
            Priorita alle domande mai incontrate; se non bastano, Sbobby completa con domande gia viste.
          </p>
        </div>
        <SharedSessionJoinPanel />
        <button
          className="sb-mobile-study-primary"
          type="button"
          disabled={
            busy
            || (filters.topicMode === "manual" && filters.topics.length === 0)
            || (filters.topicMode === "random" && eligibleTopicCount === 0)
          }
          onClick={onStart}
        >
          {busy ? "Avvio..." : "Inizia"}
        </button>
      </div>
    </section>
  );
}

function SharedSessionJoinPanel() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function joinSharedSession() {
    const normalizedCode = code.trim().toUpperCase();
    setCode(normalizedCode);
    if (!normalizedCode) {
      setMessage("Inserisci il codice della sessione condivisa.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/shared-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode }),
      });
      if (response.ok) {
        window.location.href = `/study/shared/${encodeURIComponent(normalizedCode)}`;
        return;
      }
      if (response.status === 401) {
        setMessage("Devi accedere prima di entrare in una sessione condivisa.");
        return;
      }
      if (response.status === 400 || response.status === 404) {
        setMessage("Codice non valido o sessione non trovata.");
        return;
      }
      setMessage("Impossibile entrare nella sessione. Riprova.");
    } catch {
      setMessage("Connessione non riuscita. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sb-mobile-study-shared">
      <div>
        <span>Sessione condivisa</span>
        <p>Entra con un codice ricevuto dal gruppo di studio.</p>
      </div>
      <div className="sb-mobile-study-shared-row">
        <input
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          maxLength={12}
          placeholder="ABCD12"
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            if (message) setMessage(null);
          }}
        />
        <button type="button" className="sb-mobile-study-secondary" disabled={busy} onClick={() => void joinSharedSession()}>
          {busy ? "..." : "Entra"}
        </button>
      </div>
      {message ? <p className="sb-mobile-study-helper">{message}</p> : null}
    </div>
  );
}

function MobileStatsPanel({
  clusters,
  subject,
  subjectName,
  topics,
}: {
  clusters: TopicClusterStat[];
  subject: string;
  subjectName?: string;
  topics: TopicProgressStat[];
}) {
  const subjectTopics = topics.filter((item) => !subject || item.subject === subject).slice(0, 5);
  const topClusters = clusters
    .filter((item) => !subject || item.subject === subject || item.subject === subjectName)
    .slice(0, 4);
  if (!subjectTopics.length && !topClusters.length) return null;

  return (
    <section className="sb-mobile-study-panel sb-mobile-study-stats">
      <div className="sb-mobile-study-section-head">
        <p className="sb-mobile-study-kicker">Progressi</p>
        <h2>Cluster e argomenti</h2>
      </div>
      {subjectTopics.length ? (
        <div className="sb-mobile-study-stat-group">
          <h3>Argomenti prioritari</h3>
          {subjectTopics.map((item) => <MobileTopicProgress key={item.id} item={item} />)}
        </div>
      ) : null}
      {topClusters.length ? (
        <div className="sb-mobile-study-stat-group">
          <h3>Cluster piu grandi</h3>
          {topClusters.map((item) => <MobileClusterCard key={item.id} item={item} />)}
        </div>
      ) : null}
    </section>
  );
}

function MobileTopicProgress({ item }: { item: TopicProgressStat }) {
  const reviewedPercent = item.totalQuestions > 0 ? Math.round((item.reviewedQuestions / item.totalQuestions) * 100) : 0;
  const wrongSegmentPercent = item.totalQuestions > 0
    ? Math.round((Math.min(item.wrong, item.reviewedQuestions) / item.totalQuestions) * 100)
    : 0;
  const doneSegmentPercent = Math.max(0, reviewedPercent - wrongSegmentPercent);
  const unseenPercent = item.totalQuestions > 0 ? Math.max(0, 100 - reviewedPercent) : 0;

  return (
    <article className="sb-mobile-study-stat-card">
      <div className="sb-mobile-study-stat-head">
        <div>
          <strong>{item.title}</strong>
          <span>{item.moduleTitle}</span>
        </div>
        <em>{reviewedPercent}%</em>
      </div>
      <div
        className="sb-mobile-study-stat-bar"
        aria-label={`${item.reviewedQuestions} domande riviste, ${item.wrong} tentativi con errore, ${item.unseenQuestions} non viste`}
      >
        <span data-kind="done" style={{ width: `${doneSegmentPercent}%` }} />
        <span data-kind="wrong" style={{ width: `${wrongSegmentPercent}%` }} />
        <span data-kind="unseen" style={{ width: `${unseenPercent}%` }} />
      </div>
      <p>{item.totalQuestions} totali · {item.reviewedQuestions} riviste · {item.unseenQuestions} non viste · {item.wrong} errori/parziali</p>
    </article>
  );
}

function MobileClusterCard({ item }: { item: TopicClusterStat }) {
  const reviewedPercent = item.totalQuestions > 0 ? Math.round((item.reviewedQuestions / item.totalQuestions) * 100) : 0;
  const path = item.path.length ? item.path.join(" / ") : item.moduleTitle;
  return (
    <article className="sb-mobile-study-stat-card">
      <div className="sb-mobile-study-stat-head">
        <div>
          <strong>{item.title}</strong>
          <span>{path}</span>
        </div>
        <em>{item.totalQuestions}</em>
      </div>
      <p>{reviewedPercent}% riviste · {item.unseenQuestions} non viste · {item.wrong} errori/parziali</p>
    </article>
  );
}

function QuizPanel({
  answerState,
  busy,
  index,
  question,
  selectedSubject,
  selectedTopicLabel,
  theme,
  total,
  onFinish,
  onNext,
  onSelectAnswer,
  onSkip,
}: {
  answerState: AnswerState | null;
  busy: boolean;
  index: number;
  question: QuestionView;
  selectedSubject?: Subject;
  selectedTopicLabel: string;
  theme: Theme;
  total: number;
  onFinish: () => void;
  onNext: () => void;
  onSelectAnswer: (option: QuestionOption) => void;
  onSkip: () => void;
}) {
  const progress = total ? ((index + 1) / total) * 100 : 0;
  const hasAnswer = Boolean(answerState);

  return (
    <section className="sb-mobile-study-panel sb-mobile-study-quiz">
      <div className="sb-mobile-study-progress-row">
        <span>{index + 1} / {total}</span>
        <span>{selectedSubject?.name ?? question.subjectLabel}</span>
      </div>
      <div className="sb-mobile-study-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="sb-mobile-study-context">{selectedTopicLabel}</p>
      <h2>{question.questionText}</h2>
      <div className="sb-mobile-study-options">
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={hasAnswer}
            data-selected={answerState?.selectedOptionId === option.id}
            data-correct={hasAnswer && answerState?.correctOptionId === option.id}
            data-wrong={
              hasAnswer
              && Boolean(answerState?.correctOptionId)
              && answerState?.selectedOptionId === option.id
              && answerState.correctOptionId !== option.id
            }
            onClick={() => onSelectAnswer(option)}
          >
            <span>{option.label}</span>
            <strong>{option.text}</strong>
          </button>
        ))}
      </div>
      {hasAnswer ? <AnswerReveal question={question} answerState={answerState} /> : null}
      <div className="sb-mobile-study-quiz-actions">
        <button type="button" className="sb-mobile-study-secondary" disabled={hasAnswer || busy} onClick={onSkip}>
          Salta
        </button>
        <ReportSheet questionId={question.id} theme={theme} />
        <button type="button" className="sb-mobile-study-secondary" disabled={busy} onClick={onFinish}>
          {busy ? "Salvataggio..." : "Termina simulazione"}
        </button>
        {hasAnswer ? (
          <button type="button" className="sb-mobile-study-primary" disabled={busy} onClick={onNext}>
            Avanti
          </button>
        ) : null}
      </div>
    </section>
  );
}

function AnswerReveal({ question, answerState }: { question: QuestionView; answerState: AnswerState | null }) {
  if (!answerState) return null;
  return (
    <div className="sb-mobile-study-answer">
      <p className="sb-mobile-study-kicker">Risposta</p>
      <strong>{question.explanation?.answer || "Risposta non disponibile"}</strong>
      <p data-tone={answerState.isCorrect === null ? "neutral" : answerState.isCorrect ? "correct" : "wrong"}>
        {answerState.isCorrect === null
          ? "La risposta e visibile, ma non e stato possibile correggere automaticamente questa card."
          : answerState.isCorrect
            ? answerState.recorded
              ? "Corretto. Evento registrato."
              : "Corretto. Registrazione in corso..."
            : answerState.recorded
              ? "Sbagliato. Evento registrato."
              : "Sbagliato. Registrazione in corso..."}
      </p>
      {question.explanation?.explanationShort ? <span>{question.explanation.explanationShort}</span> : null}
    </div>
  );
}

function ReportSheet({ questionId, theme }: { questionId: string; theme: Theme }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CardReportReason>("formatting_text");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitReport() {
    setBusy(true);
    setMessage(null);
    try {
      await jsonFetch(`/api/questions/${questionId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, note }),
      });
      setNote("");
      setMessage("Segnalazione inviata.");
    } catch (reportError) {
      setMessage(reportError instanceof Error ? reportError.message : "Segnalazione non inviata.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="sb-mobile-study-secondary">
          Segnala
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sb-dialog-overlay" />
        <Dialog.Content className="sb-mobile-study-report-dialog" data-theme={theme}>
          <div className="sb-mobile-study-report-header">
            <div>
              <Dialog.Title className="sb-mobile-study-report-title">Segnala problema</Dialog.Title>
              <Dialog.Description className="sb-mobile-study-report-description">
                Invia una nota agli admin su questa domanda.
              </Dialog.Description>
            </div>
            <Dialog.Close className="sb-dialog-close" aria-label="Chiudi segnalazione">
              <span aria-hidden="true">&times;</span>
            </Dialog.Close>
          </div>

          <div className="sb-mobile-study-report-body">
            <label>
              <span>Problema</span>
              <select value={reason} onChange={(event) => setReason(event.target.value as CardReportReason)}>
                {reportReasons.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Nota opzionale</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            {message ? <p className="sb-mobile-study-report-message">{message}</p> : null}
          </div>

          <div className="sb-mobile-study-report-footer">
            <Dialog.Close className="sb-mobile-study-secondary">Chiudi</Dialog.Close>
            <button type="button" className="sb-mobile-study-primary" disabled={busy} onClick={() => void submitReport()}>
              {busy ? "Invio..." : "Invia"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CompletionPanel({
  busy,
  filters,
  selectedSubject,
  selectedTopicLabel,
  summary,
  total,
  onNew,
  onRepeat,
}: {
  busy: boolean;
  filters: StudyFilters;
  selectedSubject?: Subject;
  selectedTopicLabel: string;
  summary: SessionSummary;
  total: number;
  onNew: () => void;
  onRepeat: () => void;
}) {
  return (
    <section className="sb-mobile-study-panel sb-mobile-study-complete">
      <div className="sb-mobile-study-section-head">
        <p className="sb-mobile-study-kicker">Completata</p>
        <h2>Sessione finita</h2>
      </div>
      <p className="sb-mobile-study-muted">
        {selectedSubject?.name ?? filters.subject} · {selectedTopicLabel}
      </p>
      <div className="sb-mobile-study-summary">
        <span><strong>{total}</strong> totali</span>
        <span><strong>{summary.answered}</strong> risposte</span>
        <span><strong>{summary.correct}</strong> corrette</span>
        <span><strong>{summary.wrong}</strong> errate</span>
        <span><strong>{summary.skipped}</strong> saltate</span>
      </div>
      <div className="sb-mobile-study-complete-actions">
        <button type="button" className="sb-mobile-study-primary" onClick={onNew}>
          Nuova sessione
        </button>
        <button type="button" className="sb-mobile-study-secondary" disabled={busy} onClick={onRepeat}>
          {busy ? "Avvio..." : "Ripeti stessi filtri"}
        </button>
      </div>
    </section>
  );
}
