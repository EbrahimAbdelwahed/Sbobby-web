import type { NextRequest } from "next/server";

import { getAuthUser, isAdminUser } from "@/lib/auth";
import {
  createAgentReviewLog,
  getAgentReviewQueue,
  updateQuestionReportsForReview,
  updateQuestionReview,
} from "@/lib/exam/repository";
import type { PublicationStatus, QuestionExplanation } from "@/lib/exam/types";

export const dynamic = "force-dynamic";

type AgentPatch = {
  reviewStatusId?: string;
  reliabilityLevelId?: string;
  answer?: string;
  explanationShort?: string;
  rationale?: string;
  evidenceStatus?: QuestionExplanation["evidenceStatus"];
  confidence?: number;
  warnings?: string[];
  needsHumanReview?: boolean;
  sourceChunkIds?: string[];
  publicationStatus?: PublicationStatus;
  adminNote?: string | null;
  reportStatus?: "open" | "reviewing" | "resolved" | "dismissed";
};

async function getAgentActor(request: NextRequest) {
  const user = await getAuthUser();
  if (user && (await isAdminUser(user))) {
    return { userId: user.email, mode: "session" };
  }

  const configuredToken = process.env.ADMIN_AGENT_TOKEN;
  const header = request.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (configuredToken && token && token === configuredToken) {
    return { userId: "admin-agent", mode: "bearer" };
  }

  return null;
}

function cleanPatch(body: AgentPatch) {
  const patch: AgentPatch = {};
  if (typeof body.reviewStatusId === "string") patch.reviewStatusId = body.reviewStatusId;
  if (typeof body.reliabilityLevelId === "string") patch.reliabilityLevelId = body.reliabilityLevelId;
  if (typeof body.answer === "string") patch.answer = body.answer;
  if (typeof body.explanationShort === "string") patch.explanationShort = body.explanationShort;
  if (typeof body.rationale === "string") patch.rationale = body.rationale;
  if (typeof body.evidenceStatus === "string") patch.evidenceStatus = body.evidenceStatus;
  if (typeof body.confidence === "number") patch.confidence = Math.max(0, Math.min(1, body.confidence));
  if (Array.isArray(body.warnings)) patch.warnings = body.warnings.filter((item) => typeof item === "string");
  if (typeof body.needsHumanReview === "boolean") patch.needsHumanReview = body.needsHumanReview;
  if (Array.isArray(body.sourceChunkIds)) {
    patch.sourceChunkIds = body.sourceChunkIds.filter((item) => typeof item === "string");
  }
  if (typeof body.publicationStatus === "string") patch.publicationStatus = body.publicationStatus;
  if (body.adminNote === null || typeof body.adminNote === "string") patch.adminNote = body.adminNote;
  if (typeof body.reportStatus === "string") patch.reportStatus = body.reportStatus;
  return patch;
}

export async function GET(request: NextRequest) {
  const actor = await getAgentActor(request);
  if (!actor) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const queue = await getAgentReviewQueue({
    userId: actor.userId,
    limit: Number(params.get("limit") ?? 20),
    cursor: params.get("cursor"),
    includePublished: params.get("includePublished") === "true",
  });

  return Response.json({
    actor,
    ...queue,
    contract: {
      method: "PATCH",
      body: {
        questionId: "required",
        patch: "allowed review/explanation/publication fields only",
      },
      note: "Set publicationStatus explicitly. Published cards become visible to users; non-published cards remain admin-only.",
    },
  });
}

export async function PATCH(request: NextRequest) {
  const actor = await getAgentActor(request);
  if (!actor) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { questionId?: string; patch?: AgentPatch };
  if (!body.questionId || !body.patch) {
    return Response.json({ error: "questionId and patch are required" }, { status: 400 });
  }

  const patch = cleanPatch(body.patch);
  const { reportStatus, ...questionPatch } = patch;
  const question = Object.keys(questionPatch).length
    ? await updateQuestionReview(body.questionId, questionPatch, actor.userId)
    : null;

  if (reportStatus) {
    await updateQuestionReportsForReview({
      questionId: body.questionId,
      status: reportStatus,
      resolvedBy: actor.userId,
    });
  }

  if (!question && Object.keys(questionPatch).length > 0) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }

  await createAgentReviewLog({
    questionId: body.questionId,
    actorUserId: actor.userId,
    action: "agent_review_patch",
    patch,
  });

  return Response.json({ question, updatedReports: reportStatus ?? null });
}
