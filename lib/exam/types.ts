export type Rating = "wrong" | "partial" | "correct" | "easy";
export type PublicationStatus = "unpublished" | "published" | "rejected" | "needs_repair" | "not_recoverable";
export type SharedStudyStatus = "open" | "active" | "completed" | "archived";
export type ChatRole = "user" | "assistant" | "system";
export type CardReportReason =
  | "formatting_text"
  | "wrong_answer"
  | "wrong_exam_program"
  | "skip_possible_out_of_program";
export type QuestionOrder = "random" | "ordered" | "unseen_first" | "last_wrong_first";

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
  parentTopicId: string | null;
  level: number;
  displayOrder: number;
  path: string[];
  questionCount: number;
}

export interface TopicWithModule extends Topic {
  moduleTitle: string;
}

export interface TopicTreeNode {
  id: string;
  title: string;
  subject: string;
  source_path: string;
  module_id: string;
  moduleTitle: string;
  parentTopicId: string | null;
  level: number;
  displayOrder: number;
  path: string[];
  questionCount: number;
  children: TopicTreeNode[];
  kind: "module" | "topic";
}

export interface TopicProgressStat {
  id: string;
  title: string;
  subject: string;
  moduleTitle: string;
  totalQuestions: number;
  reviewedQuestions: number;
  unseenQuestions: number;
  attempts: number;
  wrong: number;
  correct: number;
  problemScore: number;
}

export interface TopicClusterStat {
  id: string;
  title: string;
  subject: string;
  moduleTitle: string;
  path: string[];
  kind: "module" | "topic";
  totalQuestions: number;
  reviewedQuestions: number;
  unseenQuestions: number;
  attempts: number;
  wrong: number;
  correct: number;
}

export interface SubjectProgressStat {
  id: string;
  name: string;
  totalQuestions: number;
  reviewedQuestions: number;
  unseenQuestions: number;
  lastWrongQuestions: number;
}

export type SeedTopic = Omit<Topic, "parentTopicId" | "level" | "displayOrder" | "path" | "questionCount"> &
  Partial<Pick<Topic, "parentTopicId" | "level" | "displayOrder" | "path" | "questionCount">>;

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
  publicationStatus: PublicationStatus;
  programEligible: boolean;
  programEligibilityReason: string;
  programEligibilityPolicyVersion: string;
  publishedAt: string | null;
  publishedBy: string | null;
  adminNote: string | null;
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

export interface ExternalSource {
  url: string;
  title?: string;
  publisher?: string;
  accessedAt?: string;
  retrievalQuery?: string;
  excerpt?: string;
}

export interface QuestionExplanation {
  id: string;
  questionId: string;
  answer: string;
  explanationShort: string;
  rationale: string;
  sourceChunkIds: string[];
  externalSourceUrls: string[];
  externalSources: ExternalSource[];
  evidenceStatus:
    | "supported"
    | "externally_supported"
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
  completedAt?: string | null;
  filters: {
    subject?: string;
    topic?: string;
    topics?: string[];
    wrongBefore?: boolean;
    limit?: number | "all";
    order?: QuestionOrder;
  };
  state?: Record<string, unknown> | null;
}

export interface ReviewEvent {
  id: string;
  userId: string;
  questionId: string;
  sessionId: string | null;
  rating: Rating;
  createdAt: string;
}

export interface UserRole {
  userId: string;
  role: "admin";
  createdAt: string;
}

export interface SharedStudySession {
  id: string;
  code: string;
  createdBy: string;
  status: SharedStudyStatus;
  filters: StudySession["filters"];
  questionIds: string[];
  groupReviewEnabled: boolean;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface SharedStudyParticipant {
  sessionId: string;
  userId: string;
  displayName: string;
  joinedAt: string;
  leftAt: string | null;
}

export interface SharedStudyAnswer {
  id: string;
  sessionId: string;
  userId: string;
  questionId: string;
  rating: Rating;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  answeredAt: string;
}

export interface SharedStudyState {
  session: SharedStudySession;
  participants: SharedStudyParticipant[];
  answers: SharedStudyAnswer[];
  questions: QuestionView[];
  currentUserId: string;
}

export interface SharedStudyAssignment {
  question: QuestionView;
  assignedExplainers: Array<{ userId: string; displayName: string }>;
}

export interface ChatThread {
  id: string;
  userId: string;
  questionId: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: ChatRole;
  content: string;
  citations: Array<{ chunkId?: string; externalUrl?: string; sourceTitle?: string; sourcePath?: string }>;
  model: string | null;
  createdAt: string;
}

export interface CardReport {
  id: string;
  questionId: string;
  userId: string;
  reason: CardReportReason;
  note: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface AgentReviewLog {
  id: string;
  questionId: string;
  actorUserId: string;
  action: string;
  patch: Record<string, unknown>;
  createdAt: string;
}

export interface SeedData {
  generatedBy: string;
  subjects: Subject[];
  modules: Module[];
  topics: SeedTopic[];
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
  topics: TopicWithModule[];
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
  reportCount?: number;
  reports?: CardReport[];
}
