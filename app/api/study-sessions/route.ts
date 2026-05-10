import type { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth";
import { createStudySession } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    filters?: {
      subject?: string;
      topic?: string;
      topics?: string[];
      wrongBefore?: boolean;
      limit?: number;
      order?: "random" | "ordered";
    };
  };
  const session = createStudySession(
    {
      subject: typeof body.filters?.subject === "string" ? body.filters.subject : undefined,
      topic: typeof body.filters?.topic === "string" ? body.filters.topic : undefined,
      topics: Array.isArray(body.filters?.topics) ? body.filters.topics.filter(Boolean) : undefined,
      wrongBefore: Boolean(body.filters?.wrongBefore),
      limit: Number.isFinite(body.filters?.limit) ? Math.max(1, Math.min(100, Number(body.filters?.limit))) : undefined,
      order: body.filters?.order === "ordered" ? "ordered" : "random",
    },
    user.email,
  );
  return Response.json({ session: await session }, { status: 201 });
}
