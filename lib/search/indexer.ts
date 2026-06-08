import type { QuestionView } from "@/lib/exam/types";
import type { SearchDocument } from "@/lib/search/types";
import { normalizeText } from "@/lib/search/normalize";

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function buildSearchDocuments(questions: QuestionView[]): SearchDocument[] {
  return questions.map((question) => {
    const answer = question.explanation?.answer ?? "";
    const explanation = joinParts([question.explanation?.explanationShort, question.explanation?.rationale]);
    const options = question.options.map((option) => `${option.label}. ${option.text}`);
    const topicText = question.topics
      .flatMap((topic) => [topic.title, topic.moduleTitle, ...topic.path])
      .join(" ");
    const sourceLabels = [
      ...question.sourceChunks.map((chunk) =>
        joinParts([chunk.sourceTitle, chunk.lessonId, chunk.professor, chunk.headingPath.join(" > ")]),
      ),
      ...question.sourceRefs.map((ref) => joinParts([ref.path, ref.section, ref.quality])),
    ].filter(Boolean);
    const metadata = joinParts([
      question.subjectLabel,
      topicText,
      sourceLabels.join(" "),
      question.reliabilityLevel.label,
      question.reviewStatus.label,
      question.explanation?.evidenceStatus,
    ]);

    return {
      id: question.id,
      subject: question.subject,
      subjectLabel: question.subjectLabel,
      questionText: question.questionText,
      answer,
      explanation,
      options,
      topics: question.topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        moduleTitle: topic.moduleTitle,
        path: topic.path,
      })),
      sourceLabels,
      evidenceStatus: question.explanation?.evidenceStatus ?? null,
      reliabilityLabel: question.reliabilityLevel.label,
      reviewStatusLabel: question.reviewStatus.label,
      userStats: question.userStats,
      haystack: {
        question: normalizeText(joinParts([question.questionText, question.rawText])),
        answer: normalizeText(joinParts([answer, options.join(" ")])),
        explanation: normalizeText(explanation),
        metadata: normalizeText(metadata),
      },
    };
  });
}
