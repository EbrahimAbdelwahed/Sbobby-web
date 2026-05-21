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
  TopicWithModule,
} from "@/lib/exam/types";

type Theme = "light" | "dark";
type Phase = "loading" | "login" | "setup" | "quiz" | "complete";

type BootstrapPayload = {
  user: { email?: string; name?: string | null } | null;
  subjects: Subject[];
  topics: TopicWithModule[];
};

type StudyFilters = {
  subject: string;
  topic: string;
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
  const [filters, setFilters] = useState<StudyFilters>({ subject: "", topic: "", limit: 10 });
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
  const selectedSubject = subjects.find((subject) => subject.id === filters.subject);
  const selectedTopic = topics.find((topic) => topic.id === filters.topic);
  const currentQuestion = questions[index];

  function updateTheme(nextTheme: Theme) {
    setTheme(nextTheme);
  }

  function updateSubject(subject: string) {
    setFilters((current) => ({ ...current, subject, topic: "" }));
  }

  async function startSession(nextFilters = filters) {
    if (!nextFilters.subject) {
      setError("Scegli una materia prima di iniziare.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const topicsForRequest = nextFilters.topic ? [nextFilters.topic] : [];
      const sessionPayload = await jsonFetch<{ session: StudySession }>("/api/study-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            subject: nextFilters.subject,
            topics: topicsForRequest,
            limit: nextFilters.limit,
            order: "random",
          },
        }),
      });
      const params = new URLSearchParams({
        subject: nextFilters.subject,
        limit: String(nextFilters.limit),
        order: "random",
      });
      if (nextFilters.topic) params.set("topic", nextFilters.topic);
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
      setFilters(nextFilters);
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

  function moveNext(kind: "next" | "skip") {
    if (kind === "skip") {
      setSummary((current) => ({ ...current, skipped: current.skipped + 1 }));
    }
    setError(null);
    setAnswerState(null);
    if (index + 1 >= questions.length) {
      setPhase("complete");
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
          <SetupPanel
            busy={busy}
            filters={filters}
            subjects={subjects}
            topics={subjectTopics}
            onFiltersChange={setFilters}
            onSubjectChange={updateSubject}
            onStart={() => void startSession()}
          />
        ) : null}
        {phase === "quiz" && currentQuestion ? (
          <QuizPanel
            answerState={answerState}
            index={index}
            question={currentQuestion}
            selectedSubject={selectedSubject}
            selectedTopic={selectedTopic}
            theme={theme}
            total={questions.length}
            onNext={() => moveNext("next")}
            onSelectAnswer={(option) => void selectAnswer(option)}
            onSkip={() => moveNext("skip")}
          />
        ) : null}
        {phase === "complete" ? (
          <CompletionPanel
            filters={filters}
            selectedSubject={selectedSubject}
            selectedTopic={selectedTopic}
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
  filters,
  subjects,
  topics,
  onFiltersChange,
  onSubjectChange,
  onStart,
}: {
  busy: boolean;
  filters: StudyFilters;
  subjects: Subject[];
  topics: TopicWithModule[];
  onFiltersChange: (filters: StudyFilters) => void;
  onSubjectChange: (subject: string) => void;
  onStart: () => void;
}) {
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
        <label>
          <span>Argomento</span>
          <select
            value={filters.topic}
            onChange={(event) => onFiltersChange({ ...filters, topic: event.target.value })}
          >
            <option value="">Tutti gli argomenti</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topicLabel(topic)} ({topic.questionCount})
              </option>
            ))}
          </select>
        </label>
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
        <button className="sb-mobile-study-primary" type="button" disabled={busy} onClick={onStart}>
          {busy ? "Avvio..." : "Inizia"}
        </button>
      </div>
    </section>
  );
}

function QuizPanel({
  answerState,
  index,
  question,
  selectedSubject,
  selectedTopic,
  theme,
  total,
  onNext,
  onSelectAnswer,
  onSkip,
}: {
  answerState: AnswerState | null;
  index: number;
  question: QuestionView;
  selectedSubject?: Subject;
  selectedTopic?: TopicWithModule;
  theme: Theme;
  total: number;
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
      <p className="sb-mobile-study-context">{topicLabel(selectedTopic)}</p>
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
        <button type="button" className="sb-mobile-study-secondary" disabled={hasAnswer} onClick={onSkip}>
          Salta
        </button>
        <ReportSheet questionId={question.id} theme={theme} />
        {hasAnswer ? (
          <button type="button" className="sb-mobile-study-primary" onClick={onNext}>
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
  selectedTopic,
  summary,
  total,
  onNew,
  onRepeat,
}: {
  busy: boolean;
  filters: StudyFilters;
  selectedSubject?: Subject;
  selectedTopic?: TopicWithModule;
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
        {selectedSubject?.name ?? filters.subject} · {topicLabel(selectedTopic)}
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
