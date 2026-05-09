import type { NextRequest } from "next/server";

import { getAuthUser, isAdminUser } from "@/lib/auth";
import { getQuestions } from "@/lib/exam/repository";

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

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const includeReview = asBool(params.get("includeReview")) && (await isAdminUser(user));
  const topicFilters = getTopicFilters(params);
  const questions = getQuestions({
    userId: user.email,
    subject: params.get("subject"),
    topics: topicFilters,
    wrongBefore: asBool(params.get("wrongBefore")),
    includeReview,
    limit: Number(params.get("limit") ?? 100),
    order: params.get("order") === "ordered" ? "ordered" : "random",
  });
  return Response.json({ questions: await questions });
}
