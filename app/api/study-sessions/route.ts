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
    filters?: Record<string, string | boolean | undefined>;
  };
  const session = createStudySession(
    {
      subject: typeof body.filters?.subject === "string" ? body.filters.subject : undefined,
      topic: typeof body.filters?.topic === "string" ? body.filters.topic : undefined,
      wrongBefore: Boolean(body.filters?.wrongBefore),
    },
    user.email,
  );
  return Response.json({ session: await session }, { status: 201 });
}
