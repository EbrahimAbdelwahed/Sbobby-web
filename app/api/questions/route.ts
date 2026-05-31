import type { NextRequest } from "next/server";

import { getAuthUser, isAdminUser } from "@/lib/auth";
import { getQuestions } from "@/lib/exam/repository";
import type { QuestionOrder } from "@/lib/exam/types";

export const dynamic = "force-dynamic";

function asBool(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
}

function getTopicFilters(params: URLSearchParams) {
  return params
    .getAll("topic")
    .flatMap((value) => value.split(","))
    .concat(params.get("topics")?.split(",") ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
}

function getQuestionOrder(value: string | null): QuestionOrder {
  if (value === "ordered") return "ordered";
  if (value === "random") return "random";
  if (value === "last_wrong_first") return "last_wrong_first";
  return "unseen_first";
}

function isMobileStudyRequest(request: NextRequest) {
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).pathname.startsWith("/mobile-study");
  } catch {
    return referer.includes("/mobile-study");
  }
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const includeReview = asBool(params.get("includeReview")) && (await isAdminUser(user));
  const topicFilters = getTopicFilters(params);
  const requireProgramEligible = asBool(params.get("requireProgramEligible")) || isMobileStudyRequest(request);
  const questions = getQuestions({
    userId: user.email,
    questionId: params.get("question"),
    subject: params.get("subject"),
    topics: topicFilters,
    wrongBefore: asBool(params.get("wrongBefore")),
    requireProgramEligible,
    includeReview,
    limit: Number(params.get("limit") ?? 100),
    order: getQuestionOrder(params.get("order")),
  });
  return Response.json({ questions: await questions });
}
