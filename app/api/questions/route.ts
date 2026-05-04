import type { NextRequest } from "next/server";

import { getAuthUser, isAdminUser } from "@/lib/auth";
import { getQuestions } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

function asBool(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const includeReview = asBool(params.get("includeReview")) && isAdminUser(user);
  const questions = getQuestions({
    userId: user.email,
    subject: params.get("subject"),
    topic: params.get("topic"),
    reliability: params.get("reliability"),
    wrongBefore: asBool(params.get("wrongBefore")),
    includeReview,
    limit: Number(params.get("limit") ?? 100),
  });
  return Response.json({ questions: await questions });
}
