import { after, type NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth";
import {
  applyMobileSkipProgramReview,
  createAgentReviewLog,
  createMobileSkipProgramReport,
  getQuestionById,
} from "@/lib/exam/repository";
import { reviewQuestionProgramEligibility } from "@/lib/llm/program-review";

export const dynamic = "force-dynamic";

async function runProgramReview(questionId: string, userEmail: string, reportId: string | null) {
  try {
    const question = await getQuestionById(questionId, userEmail, true);
    if (!question) {
      throw new Error("Question not found for program review");
    }
    const result = await reviewQuestionProgramEligibility(question);
    await applyMobileSkipProgramReview({
      questionId,
      reportId,
      actorUserId: "mobile_skip_program_review",
      ...result,
    });
  } catch (error) {
    await createAgentReviewLog({
      questionId,
      actorUserId: "mobile_skip_program_review",
      action: "mobile_skip_program_review_failed",
      patch: {
        reportId,
        error: error instanceof Error ? error.message : "Unknown program review error",
      },
    }).catch(() => null);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { sessionId?: string | null };
  const report = await createMobileSkipProgramReport({
    questionId: id,
    userId: user.email,
    sessionId: body.sessionId,
  });

  after(() => runProgramReview(id, user.email, report?.id ?? null));

  return Response.json({ queued: true, report });
}
