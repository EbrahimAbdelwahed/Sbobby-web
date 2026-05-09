import type { NextRequest } from "next/server";

import { getAuthUser, isAdminUser } from "@/lib/auth";
import { updateQuestionReview } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || !(await isAdminUser(user))) {
    return Response.json({ error: "Forbidden" }, { status: user ? 403 : 401 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    reviewStatusId?: string;
    reliabilityLevelId?: string;
    answer?: string;
    explanationShort?: string;
    rationale?: string;
    evidenceStatus?: "supported" | "partially_supported" | "insufficient_evidence" | "conflicting_sources";
    confidence?: number;
    warnings?: string[];
    needsHumanReview?: boolean;
    sourceChunkIds?: string[];
    publicationStatus?: "unpublished" | "published" | "rejected" | "needs_repair" | "not_recoverable";
    adminNote?: string | null;
  };
  const question = await updateQuestionReview(id, body, user.email);
  if (!question) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }
  return Response.json({ question });
}
