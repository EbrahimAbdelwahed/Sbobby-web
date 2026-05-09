import type { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth";
import { submitSharedStudyAnswer } from "@/lib/exam/repository";
import type { Rating } from "@/lib/exam/types";

export const dynamic = "force-dynamic";

const ratings = new Set(["wrong", "partial", "correct", "easy"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    questionId?: string;
    rating?: Rating;
    selectedOptionId?: string | null;
  };
  if (!body.questionId || !body.rating || !ratings.has(body.rating)) {
    return Response.json({ error: "questionId and valid rating are required" }, { status: 400 });
  }
  try {
    const answer = await submitSharedStudyAnswer({
      code,
      userId: user.email,
      questionId: body.questionId,
      rating: body.rating,
      selectedOptionId: body.selectedOptionId,
    });
    if (!answer) {
      return Response.json({ error: "Shared session not found" }, { status: 404 });
    }
    return Response.json({ answer }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to submit answer" }, { status: 400 });
  }
}
