import Dexie, { type Table } from "dexie";

export interface CardState {
  id: string;
  lessonId: string;
  subject: string;
  front: string;
  back: string;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}

export interface LessonState {
  id: string;
  subject: string;
  lastDumpDate: Date | null;
  nextDumpDate: Date | null;
  dumpCoverage: number;
  lastOpenedPage: number;
}

export interface ClusterSRState {
  id: string;
  subject: string;
  clusterTitle: string;
  lastDumpDate: Date | null;
  nextDumpDate: Date | null;
  coverage: number;
}

export interface DumpSession {
  id: string;
  lessonId: string;
  subject: string;
  date: Date;
  coverage: number;
  durationSeconds: number;
  isClusterDump: boolean;
}

export interface SimulationSession {
  id: string;
  subject: string;
  date: Date;
  totalQuestions: number;
  correctAnswers: number;
  durationSeconds: number;
}

export interface DailyLog {
  id: string;
  date: string;
  cardsReviewed: number;
  dumpsCompleted: number;
}

export interface Bookmark {
  id: string;
  lessonId: string;
  subject: string;
  paragraphId: string;
  page: number;
  label: string;
  createdAt: Date;
}

class SbobbyDB extends Dexie {
  cardStates!: Table<CardState>;
  lessonStates!: Table<LessonState>;
  clusterSRStates!: Table<ClusterSRState>;
  dumpSessions!: Table<DumpSession>;
  simulationSessions!: Table<SimulationSession>;
  dailyLogs!: Table<DailyLog>;
  bookmarks!: Table<Bookmark>;

  constructor() {
    super("sbobby");
    this.version(1).stores({
      cardStates: "id, lessonId, subject, due, state",
      lessonStates: "id, subject",
      clusterSRStates: "id, subject, clusterTitle",
      dumpSessions: "id, lessonId, subject, date",
      simulationSessions: "id, subject, date",
      dailyLogs: "id, date",
      bookmarks: "id, lessonId, subject, paragraphId",
    });
  }
}

export const db = new SbobbyDB();
