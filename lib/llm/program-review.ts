import type { QuestionView } from "@/lib/exam/types";
import { callDeepSeekChat } from "@/lib/llm/deepseek";

export type ProgramReviewDecision = "in_program" | "out_of_program" | "uncertain";

export type ProgramReviewResult = {
  decision: ProgramReviewDecision;
  confidence: number;
  reasonCode: string;
  rationale: string;
  model: string;
  raw: Record<string, unknown>;
};

const PROMPT_VERSION = "mobile-skip-program-review-v1";

function extractJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  const direct = trimmed.match(/^\{[\s\S]*\}$/);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = direct?.[0] ?? fenced?.[1] ?? trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
  const parsed = JSON.parse(candidate) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("DeepSeek program review response is not a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function stringField(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberField(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function decisionField(value: unknown): ProgramReviewDecision {
  if (value === "in_program" || value === "out_of_program" || value === "uncertain") return value;
  return "uncertain";
}

function formatQuestion(question: QuestionView) {
  const topics = question.topics
    .map((topic) => `${topic.moduleTitle}: ${topic.path.length ? topic.path.join(" / ") : topic.title} [${topic.id}]`)
    .join("\n");
  const options = question.options.map((option) => `${option.label}. ${option.text}`).join("\n");
  const sourceRefs = question.sourceRefs.map((ref) => `${ref.path} (${ref.section}, ${ref.quality})`).join("\n");
  return [
    `ID: ${question.id}`,
    `Materia: ${question.subjectLabel} (${question.subject})`,
    `Testo: ${question.questionText}`,
    options ? `Opzioni:\n${options}` : null,
    question.explanation?.answer ? `Risposta approvata: ${question.explanation.answer}` : null,
    question.explanation?.explanationShort ? `Spiegazione: ${question.explanation.explanationShort}` : null,
    topics ? `Topic:\n${topics}` : "Topic: nessuno",
    sourceRefs ? `Fonti/import:\n${sourceRefs}` : null,
    `Stato attuale program_eligible: ${question.programEligible}`,
    `Motivo attuale: ${question.programEligibilityReason}`,
  ].filter(Boolean).join("\n\n");
}

export async function reviewQuestionProgramEligibility(question: QuestionView): Promise<ProgramReviewResult> {
  const messages = [
    {
      role: "system" as const,
      content:
        "Sei un revisore del programma d'esame per Sbobby Web. Devi classificare se una domanda saltata in mobile-study e nel programma corrente. Rispondi solo con JSON valido.",
    },
    {
      role: "user" as const,
      content: `Regole del programma corrente:
- Anatomia 2 e sempre fuori programma.
- Apparato riproduttore e fuori programma.
- Cavita addomino-pelvica e fuori programma, tranne surrene, pancreas e milza.
- Mammella appartiene al torace e non va esclusa come apparato riproduttore.
- Le domande di anatomia generale, torace, cuore, arti, ossa, articolazioni, sistema nervoso periferico e contenuti non esclusi restano in programma se il topic/testo lo supporta.

Classifica la domanda. Usa "uncertain" se non puoi decidere in modo robusto.

JSON richiesto:
{
  "decision": "in_program" | "out_of_program" | "uncertain",
  "confidence": 0.0-1.0,
  "reasonCode": "eligible_topic" | "excluded_anatomia_2" | "excluded_abdomino_pelvic" | "excluded_reproductive" | "unclassified_uncertain",
  "rationale": "breve spiegazione"
}

Prompt version: ${PROMPT_VERSION}

Domanda:
${formatQuestion(question)}`,
    },
  ];
  const response = await callDeepSeekChat(messages);
  const raw = extractJsonObject(response.content);
  return {
    decision: decisionField(raw.decision),
    confidence: Math.max(0, Math.min(1, numberField(raw.confidence, 0))),
    reasonCode: stringField(raw.reasonCode, "unclassified_uncertain").slice(0, 120),
    rationale: stringField(raw.rationale, "DeepSeek did not provide a rationale.").slice(0, 1200),
    model: response.model,
    raw: { ...raw, promptVersion: PROMPT_VERSION },
  };
}
