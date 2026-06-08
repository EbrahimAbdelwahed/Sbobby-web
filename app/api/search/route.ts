import type { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth";
import { searchQuestions } from "@/lib/search/repository";
import type { SearchStatusFilter } from "@/lib/search/types";

export const dynamic = "force-dynamic";

const statusFilters = new Set(["wrong", "reviewed", "unseen", "correct"]);

function clampLimit(value: string | null) {
  const parsed = Number(value ?? 25);
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const response = await searchQuestions(user.email, {
    q: params.get("q") ?? "",
    subject: params.get("subject"),
    topic: params.get("topic"),
    status: status && statusFilters.has(status) ? (status as SearchStatusFilter) : null,
    evidenceStatus: null,
    limit: clampLimit(params.get("limit")),
  });

  return Response.json(response);
}
