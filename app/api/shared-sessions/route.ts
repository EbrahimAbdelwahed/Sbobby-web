import type { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth";
import { createSharedStudySession, joinSharedStudySession } from "@/lib/exam/repository";
import type { QuestionOrder, StudySession } from "@/lib/exam/types";

export const dynamic = "force-dynamic";

function getQuestionOrder(value: unknown): QuestionOrder {
  if (value === "ordered") return "ordered";
  if (value === "random") return "random";
  return "unseen_first";
}

function parseFilters(filters: Record<string, unknown> | undefined): StudySession["filters"] {
  const rawLimit = filters?.limit;
  const limit: StudySession["filters"]["limit"] =
    rawLimit === "all" ? "all" : typeof rawLimit === "number" ? rawLimit : undefined;
  return {
    subject: typeof filters?.subject === "string" ? filters.subject : undefined,
    topic: typeof filters?.topic === "string" ? filters.topic : undefined,
    topics: Array.isArray(filters?.topics) ? filters.topics.filter((item): item is string => typeof item === "string") : undefined,
    wrongBefore: Boolean(filters?.wrongBefore),
    limit,
    order: getQuestionOrder(filters?.order),
  };
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    filters?: Record<string, unknown>;
    groupReviewEnabled?: boolean;
  };
  if (body.code) {
    const session = await joinSharedStudySession(body.code, user.email, user.name ?? user.email);
    if (!session) {
      return Response.json({ error: "Shared session not found" }, { status: 404 });
    }
    return Response.json({ session });
  }
  try {
    const session = await createSharedStudySession({
      userId: user.email,
      displayName: user.name ?? user.email,
      filters: parseFilters(body.filters),
      groupReviewEnabled: body.groupReviewEnabled !== false,
    });
    return Response.json({ session }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create session" }, { status: 400 });
  }
}
