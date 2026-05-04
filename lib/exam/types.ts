export type Rating = "wrong" | "partial" | "correct" | "easy";

export interface Subject {
  id: string;
  name: string;
}

export interface Module {
  id: string;
  subjectId: string;
  title: string;
  sourcePath: string;
}

export interface Topic {
  id: string;
  title: string;
  module_id: string;
  subject: string;
  source_path: string;
}

export interface ReliabilityLevel {
  id: string;
  code: string;
  label: string;
  description: string;
  rank: number;
  isPublishable: boolean;
  colorToken: string;
  iconKey: string;
  isActive: boolean;
}

export interface ReviewStatus {
  id: string;
  code: string;
  label: string;
  rank: number;
  isFinal: boolean;
  isActive: boolean;
}

export interface QuestionOption {
  id: string;
  questionId: string;
  label: string;
  text: string;
}

export interface SourceRef {
  path: string;
  section: string;
  quality: string;
}

export interface Question {
  id: string;
  subject: string;
  questionType: "multiple_choice" | "open";
  questionText: string;
  options: QuestionOption[];
  sourceRefs: SourceRef[];
  examDate: string | null;
  needsReview: boolean;
  rawText: string;
  topicIds: string[];
  needsTopicReview: boolean;
  reviewStatusId: string;
  reliabilityLevelId: string;
  isActive: boolean;
}

export interface SourceChunk {
  id: string;
  subject: string;
  sourceKind: string;
  sourcePath: string;
  sourceTitle: string;
  lessonId: string;
  professor: string | null;
  year: string;
  headingPath: string[];
  syllabusTopicIds: string[];
  needsTopicReview: boolean;
  textOriginal: string;
  textClean: string;
  textForEmbedding: string;
  tokenCount: number;
  contentHash: string;
  quality: string;
}

export interface QuestionExplanation {
  id: string;
  questionId: string;
  answer: string;
  explanationShort: string;
  rationale: string;
  sourceChunkIds: string[];
  evidenceStatus:
    | "supported"
    | "partially_supported"
    | "insufficient_evidence"
    | "conflicting_sources";
  confidence: number;
  warnings: string[];
  model: string;
  needsHumanReview: boolean;
}

export interface StudySession {
  id: string;
  userId: string;
  startedAt: string;
  filters: {
    subject?: string;
    topic?: string;
    wrongBefore?: boolean;
    reliability?: string;
  };
}

export interface ReviewEvent {
  id: string;
  userId: string;
  questionId: string;
  sessionId: string | null;
  rating: Rating;
  createdAt: string;
}

export interface SeedData {
  generatedBy: string;
  subjects: Subject[];
  modules: Module[];
  topics: Topic[];
  reliabilityLevels: ReliabilityLevel[];
  reviewStatuses: ReviewStatus[];
  sourceChunks: SourceChunk[];
  questions: Question[];
  questionExplanations: QuestionExplanation[];
  studySessions: StudySession[];
  reviewEvents: ReviewEvent[];
}

export interface QuestionView extends Question {
  subjectLabel: string;
  topics: Array<Topic & { moduleTitle: string }>;
  reviewStatus: ReviewStatus;
  reliabilityLevel: ReliabilityLevel;
  explanation: QuestionExplanation | null;
  sourceChunks: SourceChunk[];
  userStats: {
    attempts: number;
    wrong: number;
    correct: number;
    lastRating: Rating | null;
  };
}
