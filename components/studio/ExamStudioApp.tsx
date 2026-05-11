"use client";

/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

import type {
  CardReportReason,
  QuestionExplanation,
  QuestionView,
  Rating,
  ReliabilityLevel,
  ReviewStatus,
  SharedStudySession,
  Subject,
  TopicTreeNode,
  TopicWithModule,
} from "@/lib/exam/types";

type User = { id: string; email: string } | null;
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
type ReviewDraft = {
  answer?: string;
  explanationShort?: string;
  rationale?: string;
  evidenceStatus?: QuestionExplanation["evidenceStatus"];
  confidence?: string;
  warnings?: string;
};

const ratings: Array<{ id: Rating; label: string }> = [
  { id: "wrong", label: "Sbagliata" },
  { id: "partial", label: "Parziale" },
  { id: "correct", label: "Corretta" },
  { id: "easy", label: "Facile" },
];

const evidenceOptions: Array<{ id: QuestionExplanation["evidenceStatus"]; label: string }> = [
  { id: "supported", label: "Supportata" },
  { id: "externally_supported", label: "Supportata da fonti esterne" },
  { id: "partially_supported", label: "Parziale" },
  { id: "insufficient_evidence", label: "Evidenza insufficiente" },
  { id: "conflicting_sources", label: "Fonti in conflitto" },
];

const reportReasons: Array<{ id: CardReportReason; label: string }> = [
  { id: "formatting_text", label: "Formattazione/testo sbagliati" },
  { id: "wrong_answer", label: "Risposta sbagliata o infattuale" },
  { id: "wrong_exam_program", label: "Non appartiene al programma flaggato" },
];

type McqOutcome = {
  selectedOptionId: string;
  correctOptionId: string | null;
  isCorrect: boolean | null;
};

function tokenClass(token: string) {
  if (token === "success") return "border-[#b7ddcf] bg-[#e6f5ef] text-[#176b5b]";
  if (token === "warning") return "border-[#efd6a8] bg-[#fff3e3] text-[#8a5812]";
  if (token === "info") return "border-[#b7d7e5] bg-[#e8f4f8] text-[#256b8f]";
  return "border-[var(--sb-border)] bg-[var(--sb-surface3)] text-[var(--sb-text-dim)]";
}

function evidenceClass(status?: string) {
  if (status === "supported") return "border-[#b7ddcf] bg-[#e6f5ef] text-[#176b5b]";
  if (status === "partially_supported") return "border-[#b7d7e5] bg-[#e8f4f8] text-[#256b8f]";
  if (status === "conflicting_sources") return "border-[#efc0bb] bg-[#fff0ee] text-[#a73732]";
  return "border-[#efd6a8] bg-[#fff3e3] text-[#8a5812]";
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function collectTopicIds(node: TopicTreeNode): string[] {
  if (node.kind === "topic" && node.children.length === 0) return [node.id];
  return node.children.flatMap(collectTopicIds);
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
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

function ratingForMcqOutcome(outcome: McqOutcome): Rating | null {
  if (outcome.isCorrect == null) return null;
  return outcome.isCorrect ? "correct" : "wrong";
}

export function ExamStudioApp() {
  const [user, setUser] = useState<User>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<TopicWithModule[]>([]);
  const [topicTree, setTopicTree] = useState<TopicTreeNode[]>([]);
  const [questions, setQuestions] = useState<QuestionView[]>([]);
  const [topicStats, setTopicStats] = useState<TopicStat[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([]);
  const [tab, setTab] = useState<"study" | "stats">("study");
  const [subject, setSubject] = useState("");
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [topicSearch, setTopicSearch] = useState("");
  const [wrongBefore, setWrongBefore] = useState(false);
  const [questionLimit, setQuestionLimit] = useState(20);
  const [joinCode, setJoinCode] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex] ?? null;
  const topicMap = useMemo(() => new Map(topics.map((item) => [item.id, item])), [topics]);
  const selectedSet = useMemo(() => new Set(selectedTopicIds), [selectedTopicIds]);
  const selectedTopicLabels = selectedTopicIds
    .map((id) => topicMap.get(id))
    .filter((item): item is TopicWithModule => Boolean(item));
  const filteredTree = useMemo(() => {
    const query = normalizeQuery(topicSearch);
    const tree = topicTree.filter((node) => !subject || node.subject === subject);
    if (!query) return tree;

    function filterNode(node: TopicTreeNode): TopicTreeNode | null {
      const selfMatches = `${node.title} ${node.moduleTitle} ${node.path.join(" ")}`.toLowerCase().includes(query);
      const children = node.children.map(filterNode).filter((item): item is TopicTreeNode => Boolean(item));
      if (!selfMatches && children.length === 0) return null;
      return { ...node, children };
    }

    return tree.map(filterNode).filter((item): item is TopicTreeNode => Boolean(item));
  }, [subject, topicSearch, topicTree]);

  async function loadBase() {
    setLoading(true);
    const payload = await jsonFetch<{
      user: User;
      subjects: Subject[];
      topics: TopicWithModule[];
      tree: TopicTreeNode[];
    }>("/api/bootstrap");
    setUser(payload.user);
    setSubjects(payload.subjects);
    setTopics(payload.topics ?? []);
    setTopicTree(payload.tree ?? []);
    setLoading(false);
    if (!payload.user) {
      window.location.href = "/login";
    }
  }

  async function loadQuestions() {
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    for (const topicId of selectedTopicIds) params.append("topic", topicId);
    if (wrongBefore) params.set("wrongBefore", "true");
    params.set("limit", String(questionLimit));
    const payload = await jsonFetch<{ questions: QuestionView[] }>(`/api/questions?${params}`);
    setQuestions(payload.questions);
    setCurrentIndex(0);
    setShowAnswer(false);
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
    }
  }, [loading, subject, selectedTopicIds.join(","), wrongBefore, questionLimit]);

  useEffect(() => {
    if (!loading && tab === "stats") {
      void loadStats();
    }
  }, [loading, tab]);

  function toggleTopicNode(node: TopicTreeNode) {
    const ids = collectTopicIds(node);
    const allSelected = ids.every((id) => selectedSet.has(id));
    const next = new Set(selectedTopicIds);
    for (const id of ids) {
      if (allSelected) next.delete(id);
      else next.add(id);
    }
    setSelectedTopicIds(Array.from(next));
  }

  function changeSubject(nextSubject: string) {
    setSubject(nextSubject);
    setSelectedTopicIds([]);
  }

  async function createPersonalSession() {
    return jsonFetch<{ session: { id: string } }>("/api/study-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: {
          subject,
          topic: selectedTopicIds.join(","),
          topics: selectedTopicIds,
          wrongBefore,
          limit: questionLimit,
        },
      }),
    });
  }

  async function startSession() {
    const payload = await createPersonalSession();
    setSessionId(payload.session.id);
    setMessage("Sessione avviata");
  }

  async function resetSimulation() {
    try {
      setMessage(null);
      const payload = await createPersonalSession();
      setSessionId(payload.session.id);
      setCurrentIndex(0);
      setShowAnswer(false);
      await loadQuestions();
      await loadStats();
      setMessage("Simulazione resettata. I progressi già registrati restano salvati.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reset non riuscito");
    }
  }

  async function createSharedSession() {
    const payload = await jsonFetch<{ session: SharedStudySession }>("/api/shared-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: { subject, topics: selectedTopicIds, wrongBefore, limit: questionLimit, order: "random" },
        groupReviewEnabled: true,
      }),
    });
    window.location.href = `/study/shared/${payload.session.code}`;
  }

  async function joinSharedSession() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    await jsonFetch<{ session: SharedStudySession }>("/api/shared-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    window.location.href = `/study/shared/${code}`;
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

  async function logout() {
    await signOut({ callbackUrl: "/login" });
  }

  if (loading) {
    return (
      <main className="sb-page px-5 py-6 text-sm text-[var(--sb-text-dim)]">
        Caricamento...
      </main>
    );
  }

  return (
    <main className="sb-page">
      <div className="sb-shell">
        <header className="sb-header">
          <div>
            <p className="sb-kicker">Sbobby</p>
            <h1 className="sb-title">Studio</h1>
            <p className="mt-1 text-sm text-[var(--sb-text-dim)]">Card pubblicate, ripasso personale e sessioni condivise.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--sb-text-dim)]">
            <span>{user?.email ?? "Sessione locale"}</span>
            <button className="sb-button-secondary" onClick={logout}>Esci</button>
          </div>
        </header>

        <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="sb-segmented">
            {(["study", "stats"] as const).map((item) => (
              <button
                key={item}
                className="sb-segment"
                data-active={tab === item}
                onClick={() => setTab(item)}
              >
                {item === "study" ? "Studio" : "Statistiche"}
              </button>
            ))}
          </div>
          {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}
        </section>

        {tab === "study" ? (
          <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="sb-panel h-fit p-4 xl:sticky xl:top-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--sb-text)]">Filtri</h2>
                  <p className="text-sm text-[var(--sb-text-dim)]">{questions.length} card disponibili</p>
                </div>
                <button className="sb-button-secondary" onClick={() => { setSelectedTopicIds([]); setWrongBefore(false); }}>
                  Reset
                </button>
              </div>

              <TopicPicker
                tree={filteredTree}
                subjects={subjects}
                activeSubject={subject}
                selectedSet={selectedSet}
                search={topicSearch}
                onSubject={changeSubject}
                onSearch={setTopicSearch}
                onToggle={toggleTopicNode}
              />

              {selectedTopicLabels.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTopicLabels.slice(0, 8).map((item) => (
                    <button key={item.id} className="sb-chip" onClick={() => setSelectedTopicIds((ids) => ids.filter((id) => id !== item.id))}>
                      {item.title}
                    </button>
                  ))}
                  {selectedTopicLabels.length > 8 ? (
                    <span className="sb-chip">
                      +{selectedTopicLabels.length - 8}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <label className="mt-4 flex items-center gap-2 text-sm font-medium text-[var(--sb-text)]">
                <input checked={wrongBefore} onChange={(event) => setWrongBefore(event.target.checked)} type="checkbox" />
                Sbagliate in precedenza
              </label>

              <label className="sb-label mt-5">Numero domande</label>
              <input
                className="sb-input"
                min={1}
                max={100}
                type="number"
                value={questionLimit}
                onChange={(event) => setQuestionLimit(Math.max(1, Math.min(100, Number(event.target.value) || 20)))}
              />

              <button className="sb-action-primary mt-5 w-full" onClick={startSession}>
                Avvia sessione
              </button>
              <button className="sb-button-secondary mt-3 w-full" onClick={resetSimulation}>
                Reset simulazione
              </button>
              <button className="sb-button-secondary mt-3 w-full" onClick={createSharedSession}>
                Crea sessione condivisa
              </button>
              <div className="mt-3 flex gap-2">
                <input
                  className="sb-input"
                  maxLength={6}
                  placeholder="ABCD12"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                />
                <button className="sb-button-secondary" onClick={joinSharedSession}>Entra</button>
              </div>
            </aside>

            <section className="min-h-[540px] min-w-0">
              {questions.length === 0 ? (
                <EmptyState title="Nessuna card pubblicabile" text="Approva alcune card nella vista Review oppure allarga i filtri." />
              ) : currentQuestion ? (
                <StudyCard
                  key={currentQuestion.id}
                  question={currentQuestion}
                  index={currentIndex}
                  total={questions.length}
                  showAnswer={showAnswer}
                  onToggleAnswer={() => setShowAnswer((value) => !value)}
                  onRate={submitRating}
                />
              ) : null}
            </section>
          </section>
        ) : null}

        {tab === "stats" ? (
          <section className="grid gap-5 lg:grid-cols-2">
            <StatsList title="Argomenti problematici" rows={topicStats.map((item) => ({ id: item.id, title: item.title, meta: `${item.moduleTitle} - ${item.wrong}/${item.attempts} errori` }))} />
            <StatsList title="Domande problematiche" rows={questionStats.map((item) => ({ id: item.id, title: item.questionText, meta: `${item.subject} - ${item.wrong}/${item.attempts} errori` }))} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

function TopicPicker({
  tree,
  subjects,
  activeSubject,
  selectedSet,
  search,
  onSubject,
  onSearch,
  onToggle,
}: {
  tree: TopicTreeNode[];
  subjects: Subject[];
  activeSubject: string;
  selectedSet: Set<string>;
  search: string;
  onSubject: (subject: string) => void;
  onSearch: (value: string) => void;
  onToggle: (node: TopicTreeNode) => void;
}) {
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const subjectIds = activeSubject ? [activeSubject] : subjects.map((subject) => subject.id);
  return (
    <div className="mt-5">
      <label className="sb-label">Materia, modulo, argomento</label>
      <input
        className="sb-input"
        placeholder="Cerca modulo o argomento"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
      />
      <div className="mt-2 max-h-[360px] overflow-auto rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface3)] p-2">
        {subjectIds.length ? subjectIds.map((subjectId) => {
          const subjectNodes = tree.filter((node) => node.subject === subjectId);
          if (!subjectNodes.length && search) return null;
          return (
            <details key={subjectId} className="group" open={activeSubject === subjectId || Boolean(search)}>
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-white">
                <button
                  className="rounded-md border border-[var(--sb-border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--sb-text)]"
                  onClick={(event) => {
                    event.preventDefault();
                    onSubject(activeSubject === subjectId ? "" : subjectId);
                  }}
                >
                  {activeSubject === subjectId ? "Tutte" : "Scegli"}
                </button>
                <span className="font-semibold text-[var(--sb-text)]">{subjectMap.get(subjectId) ?? subjectId}</span>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[var(--sb-text-dim)]">
                  {subjectNodes.reduce((total, node) => total + node.questionCount, 0)}
                </span>
              </summary>
              <div className="ml-3 border-l border-[var(--sb-border)] pl-2">
                {subjectNodes.map((node) => (
                  <TopicNode key={node.id} node={node} selectedSet={selectedSet} onToggle={onToggle} forceOpen={Boolean(search)} />
                ))}
              </div>
            </details>
          );
        }) : null}
        {!tree.length ? <p className="px-2 py-3 text-sm text-[var(--sb-text-dim)]">Nessun argomento trovato.</p> : null}
      </div>
    </div>
  );
}

function TopicNode({
  node,
  selectedSet,
  onToggle,
  forceOpen = false,
}: {
  node: TopicTreeNode;
  selectedSet: Set<string>;
  onToggle: (node: TopicTreeNode) => void;
  forceOpen?: boolean;
}) {
  const ids = collectTopicIds(node);
  const selectedCount = ids.filter((id) => selectedSet.has(id)).length;
  const checked = ids.length > 0 && selectedCount === ids.length;
  const partial = selectedCount > 0 && !checked;

  return (
    <details className="group" open={forceOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-white">
        <input
          type="checkbox"
          checked={checked}
          aria-checked={partial ? "mixed" : checked}
          onChange={() => onToggle(node)}
          onClick={(event) => event.stopPropagation()}
        />
        <span className={node.kind === "module" ? "font-semibold text-[var(--sb-text)]" : "text-[#40524d]"}>
          {node.title}
        </span>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[var(--sb-text-dim)]">
          {node.questionCount}
        </span>
      </summary>
      {node.children.length ? (
        <div className="ml-5 border-l border-[var(--sb-border)] pl-2">
          {node.children.map((child) => (
            <TopicNode key={child.id} node={child} selectedSet={selectedSet} onToggle={onToggle} forceOpen={forceOpen} />
          ))}
        </div>
      ) : null}
    </details>
  );
}

function StudyCard({
  question,
  index,
  total,
  showAnswer,
  onToggleAnswer,
  onRate,
}: {
  question: QuestionView;
  index: number;
  total: number;
  showAnswer: boolean;
  onToggleAnswer: () => void;
  onRate: (rating: Rating) => void;
}) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [openAnswer, setOpenAnswer] = useState("");
  const correctOptionId = correctOptionIdFor(question);
  const hasOptions = question.options.length > 0;
  const selectedOutcome: McqOutcome | null = selectedOptionId
    ? {
        selectedOptionId,
        correctOptionId,
        isCorrect: correctOptionId ? selectedOptionId === correctOptionId : null,
      }
    : null;
  const autoRating = selectedOutcome ? ratingForMcqOutcome(selectedOutcome) : null;

  useEffect(() => {
    setSelectedOptionId(null);
    setOpenAnswer("");
  }, [question.id]);

  return (
    <article className="sb-panel overflow-hidden">
      <div className="border-b border-[var(--sb-border)] bg-[var(--sb-surface3)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="sb-badge">{question.subjectLabel}</span>
        {question.explanation ? (
          <span className={`sb-badge ${evidenceClass(question.explanation.evidenceStatus)}`}>{question.explanation.evidenceStatus}</span>
        ) : null}
          <span className="ml-auto text-sm font-semibold text-[var(--sb-text-dim)]">{index + 1} / {total}</span>
        </div>
      </div>
      <div className="p-5 md:p-7">
      <h2 className="max-w-5xl text-2xl font-semibold leading-snug text-[var(--sb-text)] md:text-[1.7rem]">{question.questionText}</h2>
      {hasOptions ? (
        <div className="mt-6 grid gap-3">
          {question.options.map((option) => (
            <button
              key={option.id}
              className="sb-option text-left text-sm"
              data-selected={selectedOptionId === option.id}
              data-correct={showAnswer && correctOptionId === option.id}
              data-wrong={showAnswer && selectedOptionId === option.id && correctOptionId !== option.id}
              onClick={() => {
                setSelectedOptionId(option.id);
                if (!showAnswer) onToggleAnswer();
              }}
            >
              <span className="sb-option-letter">{option.label}</span>
              <span className="pt-0.5 leading-6">{option.text}</span>
            </button>
          ))}
        </div>
      ) : (
        <label className="mt-6 block">
          <span className="sb-label">La tua risposta</span>
          <textarea
            className="sb-textarea mt-2 min-h-28"
            value={openAnswer}
            onChange={(event) => setOpenAnswer(event.target.value)}
            placeholder="Scrivi la risposta prima di vedere la soluzione"
          />
        </label>
      )}
      <button className="sb-action-primary mt-6" onClick={onToggleAnswer}>
        {showAnswer ? "Nascondi risposta" : "Mostra risposta"}
      </button>
      {showAnswer && question.explanation ? (
        <div className="mt-6 border-t border-[var(--sb-border)] pt-6">
          <div className="sb-answer-box">
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--sb-accent)]">Risposta</h3>
            <p className="mt-2 text-base font-semibold leading-7 text-[var(--sb-text)]">{question.explanation.answer}</p>
            {selectedOutcome ? (
              <p className={`mt-3 text-sm font-semibold ${selectedOutcome.isCorrect ? "text-emerald-700" : selectedOutcome.isCorrect === false ? "text-rose-700" : "text-[var(--sb-text-dim)]"}`}>
                {selectedOutcome.isCorrect == null
                  ? "Risposta non correggibile automaticamente: valuta manualmente."
                  : selectedOutcome.isCorrect
                    ? "Corretto."
                    : "Sbagliato."}
              </p>
            ) : null}
            {!hasOptions && openAnswer.trim() ? (
              <div className="mt-4 rounded-md border border-[var(--sb-border)] bg-white p-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--sb-text-dim)]">La tua risposta</h3>
                <p className="mt-2 text-sm leading-6 text-[#40524d]">{openAnswer}</p>
              </div>
            ) : null}
            <h3 className="mt-5 text-sm font-bold uppercase tracking-[0.08em] text-[var(--sb-accent)]">Spiegazione</h3>
            <p className="mt-2 text-sm leading-6 text-[#40524d]">{question.explanation.explanationShort}</p>
          </div>
          <details className="sb-source-box mt-5">
            <summary className="cursor-pointer font-semibold text-[var(--sb-text)]">Fonti citate</summary>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {question.sourceChunks.slice(0, 4).map((chunk) => (
              <details key={chunk.id} className="sb-source-box">
                <summary className="cursor-pointer font-semibold text-[var(--sb-text)]">{chunk.sourceTitle}</summary>
                <p className="mt-2 leading-6 text-[var(--sb-text-dim)]">{chunk.textClean.slice(0, 700)}</p>
              </details>
            ))}
            {question.explanation.externalSources.slice(0, 4).map((source) => (
              <a key={source.url} className="sb-source-box block" href={source.url} target="_blank" rel="noreferrer">
                <span className="font-semibold text-[var(--sb-text)]">{source.title || source.publisher || source.url}</span>
                {source.excerpt ? <p className="mt-2 leading-6 text-[var(--sb-text-dim)]">{source.excerpt}</p> : null}
              </a>
            ))}
          </div>
          </details>
          <div className="mt-6 flex flex-wrap gap-2">
            {autoRating ? (
              <button className="sb-action-primary" onClick={() => onRate(autoRating)}>
                Registra e continua
              </button>
            ) : ratings.map((rating) => (
                <button key={rating.id} className="sb-button-secondary" onClick={() => onRate(rating.id)}>
                  {rating.label}
                </button>
              ))}
          </div>
          <QuestionChat questionId={question.id} />
          <CardReportForm questionId={question.id} />
        </div>
      ) : null}
      </div>
    </article>
  );
}

function QuestionChat({ questionId }: { questionId: string }) {
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string }>>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void jsonFetch<{ messages: Array<{ id: string; role: string; content: string }> }>(`/api/questions/${questionId}/chat`)
      .then((payload) => setMessages(payload.messages))
      .catch(() => setMessages([]));
  }, [questionId]);

  async function sendMessage(contentOverride?: string) {
    const content = (contentOverride ?? draft).trim();
    if (!content) return;
    if (!contentOverride) setDraft("");
    setLoading(true);
    setMessages((items) => [...items, { id: `local-${Date.now()}`, role: "user", content }]);
    try {
      const payload = await jsonFetch<{ message: { id: string; role: string; content: string } }>(`/api/questions/${questionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      setMessages((items) => [...items, payload.message]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface3)] p-4">
      <h3 className="text-sm font-bold text-[var(--sb-text)]">Chat sul concetto</h3>
      <button
        className="sb-button-secondary mt-3"
        disabled={loading}
        onClick={() => sendMessage("Genera una spiegazione sintetica e autonoma della risposta usando solo i chunk citati. Evita di copiare i chunk: costruisci un blocco chiaro per ripassare il concetto.")}
      >
        Genera spiegazione dai chunk
      </button>
      <div className="mt-3 grid max-h-64 gap-2 overflow-auto">
        {messages.length ? messages.map((message) => (
          <div key={message.id} className={`rounded-lg border p-3 text-sm leading-6 ${message.role === "assistant" ? "border-[var(--sb-border)] bg-white text-[#40524d]" : "border-[#b7ddcf] bg-[#e6f5ef] text-[var(--sb-text)]"}`}>
            {message.content}
          </div>
        )) : <p className="text-sm text-[var(--sb-text-dim)]">Fai una domanda dopo aver letto risposta e fonti.</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="sb-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void sendMessage(); }}
        />
        <button className="sb-button-secondary" disabled={loading} onClick={() => sendMessage()}>
          Invia
        </button>
      </div>
    </section>
  );
}

function CardReportForm({ questionId }: { questionId: string }) {
  const [reason, setReason] = useState<CardReportReason>("formatting_text");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitReport() {
    setLoading(true);
    setMessage(null);
    try {
      await jsonFetch(`/api/questions/${questionId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, note }),
      });
      setNote("");
      setMessage("Segnalazione inviata");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Segnalazione non inviata");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="mt-5 rounded-lg border border-[var(--sb-border)] bg-white p-4">
      <summary className="cursor-pointer text-sm font-bold text-[var(--sb-text)]">Segnala un errore nella card</summary>
      <div className="mt-3 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold text-[#40524d]">
          Tipo di problema
          <select className="sb-input" value={reason} onChange={(event) => setReason(event.target.value as CardReportReason)}>
            {reportReasons.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[#40524d]">
          Nota opzionale
          <textarea className="sb-textarea min-h-20" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button className="sb-button-secondary" disabled={loading} onClick={submitReport}>Invia segnalazione</button>
          {message ? <span className="text-sm font-medium text-[var(--sb-text-dim)]">{message}</span> : null}
        </div>
      </div>
    </details>
  );
}

function ReviewCard({
  question,
  reliabilityLevels,
  draft,
  onDraft,
  onSave,
}: {
  question: QuestionView;
  reliabilityLevels: ReliabilityLevel[];
  draft: Required<ReviewDraft>;
  onDraft: (patch: ReviewDraft) => void;
  onSave: (patch: Partial<ReviewDraft> & { reviewStatusId?: string; reliabilityLevelId?: string; needsHumanReview?: boolean; publicationStatus?: string }) => void;
}) {
  return (
    <article className="sb-panel overflow-hidden">
      <div className="border-b border-[var(--sb-border)] bg-[var(--sb-surface3)] px-4 py-3">
        <div className="flex flex-wrap gap-2 text-xs">
        <span className="sb-badge">{question.subjectLabel}</span>
        <span className="sb-badge">{question.reviewStatus.label}</span>
        <span className={`sb-badge ${tokenClass(question.reliabilityLevel.colorToken)}`}>{question.reliabilityLevel.label}</span>
        {question.explanation ? <span className={`sb-badge ${evidenceClass(question.explanation.evidenceStatus)}`}>{question.explanation.evidenceStatus}</span> : null}
        {question.reportCount ? <span className="sb-badge border-[#efc0bb] bg-[#fff0ee] text-[#a73732]">{question.reportCount} segnalazioni</span> : null}
        </div>
      </div>
      <div className="p-4">
      <h3 className="text-lg font-semibold leading-7 text-[var(--sb-text)]">{question.questionText}</h3>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-[#40524d]">
          Risposta
          <textarea className="sb-textarea" value={draft.answer} onChange={(event) => onDraft({ answer: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[#40524d]">
          Spiegazione
          <textarea className="sb-textarea" value={draft.explanationShort} onChange={(event) => onDraft({ explanationShort: event.target.value })} />
        </label>
      </div>
      <label className="mt-3 grid gap-1 text-sm font-semibold text-[#40524d]">
        Rationale interno
        <textarea className="sb-textarea min-h-20" value={draft.rationale} onChange={(event) => onDraft({ rationale: event.target.value })} />
      </label>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-[#40524d]">
          Evidenza
          <select className="sb-input" value={draft.evidenceStatus} onChange={(event) => onDraft({ evidenceStatus: event.target.value as QuestionExplanation["evidenceStatus"] })}>
            {evidenceOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[#40524d]">
          Confidence
          <input className="sb-input" value={draft.confidence} onChange={(event) => onDraft({ confidence: event.target.value })} inputMode="decimal" />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[#40524d]">
          Warning
          <input className="sb-input" value={draft.warnings} onChange={(event) => onDraft({ warnings: event.target.value })} />
        </label>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {question.sourceChunks.slice(0, 4).map((chunk) => (
          <details key={chunk.id} className="sb-source-box text-[var(--sb-text-dim)]">
            <summary className="cursor-pointer font-semibold text-[var(--sb-text)]">{chunk.sourceTitle}</summary>
            <p className="mt-2 leading-6">{chunk.textClean.slice(0, 520)}</p>
          </details>
        ))}
        {question.explanation?.externalSources.slice(0, 4).map((source) => (
          <a key={source.url} className="sb-source-box block text-[var(--sb-text-dim)]" href={source.url} target="_blank" rel="noreferrer">
            <span className="font-semibold text-[var(--sb-text)]">{source.title || source.publisher || source.url}</span>
            {source.excerpt ? <p className="mt-2 leading-6">{source.excerpt}</p> : null}
          </a>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="sb-button-secondary" onClick={() => onSave({ needsHumanReview: true })}>Salva</button>
        <button className="sb-button-secondary" onClick={() => onSave({ reviewStatusId: "reviewing", reliabilityLevelId: "source_supported", evidenceStatus: "partially_supported", needsHumanReview: true, publicationStatus: "needs_repair" })}>Needs evidence</button>
        <button className="sb-button-secondary" onClick={() => onSave({ reviewStatusId: "rejected", reliabilityLevelId: "needs_review", needsHumanReview: false, publicationStatus: "rejected" })}>Rifiuta</button>
        <button className="sb-button-secondary" onClick={() => onSave({ publicationStatus: "unpublished", needsHumanReview: true })}>Unpublish</button>
        <button className="sb-action-primary" onClick={() => onSave({ reviewStatusId: "approved", reliabilityLevelId: "human_verified", evidenceStatus: "supported", confidence: "1", warnings: "", needsHumanReview: false, publicationStatus: "published" })}>Pubblica</button>
        <select className="sb-input max-w-56" value={question.reliabilityLevelId} onChange={(event) => onSave({ reliabilityLevelId: event.target.value })}>
          {reliabilityLevels.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
      </div>
    </article>
  );
}

export function AdminReviewApp() {
  const [questions, setQuestions] = useState<QuestionView[]>([]);
  const [reliabilityLevels, setReliabilityLevels] = useState<ReliabilityLevel[]>([]);
  const [reviewStatuses, setReviewStatuses] = useState<ReviewStatus[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAdmin() {
    setLoading(true);
    const [queuePayload, reliabilityPayload, statusesPayload] = await Promise.all([
      jsonFetch<{ questions: QuestionView[] }>("/api/admin/review-queue"),
      jsonFetch<{ reliabilityLevels: ReliabilityLevel[] }>("/api/reliability-levels"),
      jsonFetch<{ reviewStatuses: ReviewStatus[] }>("/api/review-statuses"),
    ]);
    setQuestions(queuePayload.questions);
    setReliabilityLevels(reliabilityPayload.reliabilityLevels);
    setReviewStatuses(statusesPayload.reviewStatuses);
    setLoading(false);
  }

  useEffect(() => {
    void loadAdmin().catch(() => {
      setMessage("Accesso admin richiesto");
      setLoading(false);
    });
  }, []);

  function updateDraft(questionId: string, patch: ReviewDraft) {
    setReviewDrafts((drafts) => ({
      ...drafts,
      [questionId]: { ...drafts[questionId], ...patch },
    }));
  }

  function draftFor(question: QuestionView): Required<ReviewDraft> {
    const draft = reviewDrafts[question.id] ?? {};
    return {
      answer: draft.answer ?? question.explanation?.answer ?? "",
      explanationShort: draft.explanationShort ?? question.explanation?.explanationShort ?? "",
      rationale: draft.rationale ?? question.explanation?.rationale ?? "",
      evidenceStatus: draft.evidenceStatus ?? question.explanation?.evidenceStatus ?? "insufficient_evidence",
      confidence: draft.confidence ?? String(question.explanation?.confidence ?? 0),
      warnings: draft.warnings ?? question.explanation?.warnings.join(", ") ?? "",
    };
  }

  async function updateQuestion(question: QuestionView, patch: Partial<ReviewDraft> & {
    reviewStatusId?: string;
    reliabilityLevelId?: string;
    needsHumanReview?: boolean;
    publicationStatus?: string;
  }) {
    const draft = draftFor(question);
    const confidence = Number(patch.confidence ?? draft.confidence);
    const warnings = (patch.warnings ?? draft.warnings)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    await jsonFetch(`/api/admin/questions/${question.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer: patch.answer ?? draft.answer,
        explanationShort: patch.explanationShort ?? draft.explanationShort,
        rationale: patch.rationale ?? draft.rationale,
        evidenceStatus: patch.evidenceStatus ?? draft.evidenceStatus,
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
        warnings,
        reviewStatusId: patch.reviewStatusId,
        reliabilityLevelId: patch.reliabilityLevelId,
        needsHumanReview: patch.needsHumanReview,
        publicationStatus: patch.publicationStatus,
      }),
    });
    setMessage("Review aggiornata");
    await loadAdmin();
  }

  return (
    <main className="sb-page">
      <div className="sb-shell">
        <header className="sb-header">
          <div>
            <p className="sb-kicker">Sbobby admin</p>
            <h1 className="sb-title">Review card</h1>
            <p className="mt-2 text-sm text-[var(--sb-text-dim)]">Stati: {reviewStatuses.map((item) => item.label).join(", ")}</p>
          </div>
          {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}
        </header>
        {loading ? <p className="text-sm text-[var(--sb-text-dim)]">Caricamento...</p> : (
          <div className="grid gap-4">
            {questions.map((question) => (
              <ReviewCard
                key={question.id}
                question={question}
                reliabilityLevels={reliabilityLevels}
                draft={draftFor(question)}
                onDraft={(patch) => updateDraft(question.id, patch)}
                onSave={(patch) => updateQuestion(question, patch)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatsList({ title, rows }: { title: string; rows: Array<{ id: string; title: string; meta: string }> }) {
  return (
    <section className="sb-panel p-4">
      <h2 className="text-xl font-semibold text-[var(--sb-text)]">{title}</h2>
      <div className="mt-4 grid gap-2">
        {rows.length ? rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface3)] p-3">
            <p className="line-clamp-2 text-sm font-semibold text-[var(--sb-text)]">{row.title}</p>
            <p className="mt-1 text-xs text-[var(--sb-text-dim)]">{row.meta}</p>
          </div>
        )) : <p className="text-sm text-[var(--sb-text-dim)]">Nessun evento registrato.</p>}
      </div>
    </section>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="sb-panel p-8">
      <h2 className="text-xl font-semibold text-[var(--sb-text)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--sb-text-dim)]">{text}</p>
    </div>
  );
}
