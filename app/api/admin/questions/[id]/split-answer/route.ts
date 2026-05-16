import type { NextRequest } from "next/server";

import { getAuthUser, isAdminUser } from "@/lib/auth";
import { splitQuestionAnswer } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || !(await isAdminUser(user))) {
    return Response.json({ error: "Forbidden" }, { status: user ? 403 : 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    currentAnswer?: string;
    newAnswer?: string;
    currentExplanationShort?: string;
    newExplanationShort?: string;
    currentRationale?: string;
    newRationale?: string;
    questionText?: string;
  };

  if (!body.currentAnswer?.trim() || !body.newAnswer?.trim()) {
    return Response.json({ error: "Both split answers are required" }, { status: 400 });
  }

  const result = await splitQuestionAnswer(id, {
    currentAnswer: body.currentAnswer,
    newAnswer: body.newAnswer,
    currentExplanationShort: body.currentExplanationShort,
    newExplanationShort: body.newExplanationShort,
    currentRationale: body.currentRationale,
    newRationale: body.newRationale,
    questionText: body.questionText,
  }, user.email);

  if (!result.currentQuestion || !result.newQuestion) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }

  return Response.json(result);
}
