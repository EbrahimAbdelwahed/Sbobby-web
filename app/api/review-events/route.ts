import type { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth";
import { createReviewEvent } from "@/lib/exam/repository";
import type { Rating } from "@/lib/exam/types";

export const dynamic = "force-dynamic";

const ratings = new Set(["wrong", "partial", "correct", "easy"]);

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    questionId?: string;
    sessionId?: string;
    rating?: Rating;
  };
  if (!body.questionId || !body.rating || !ratings.has(body.rating)) {
    return Response.json({ error: "questionId and valid rating are required" }, { status: 400 });
  }
  const event = createReviewEvent({
    userId: user.email,
    questionId: body.questionId,
    sessionId: body.sessionId,
    rating: body.rating,
  });
  return Response.json({ event: await event }, { status: 201 });
}
