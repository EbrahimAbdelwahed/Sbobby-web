import type { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth";
import { completeStudySession } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: RouteContext<"/api/study-sessions/[id]">) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    state?: Record<string, unknown>;
  };
  if (!body.state || typeof body.state !== "object" || Array.isArray(body.state)) {
    return Response.json({ error: "state is required" }, { status: 400 });
  }
  try {
    const session = await completeStudySession({
      sessionId: id,
      userId: user.email,
      state: body.state,
    });
    return Response.json({ session });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Study session not found" },
      { status: 404 },
    );
  }
}
