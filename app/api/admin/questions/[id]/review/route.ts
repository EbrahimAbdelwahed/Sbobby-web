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
    questionText?: string;
    options?: Array<{ id?: string; label?: string; text?: string }>;
    answer?: string;
    explanationShort?: string;
    rationale?: string;
    evidenceStatus?: "supported" | "externally_supported" | "partially_supported" | "insufficient_evidence" | "conflicting_sources";
    confidence?: number;
    warnings?: string[];
    needsHumanReview?: boolean;
    sourceChunkIds?: string[];
    externalSourceUrls?: string[];
    externalSources?: Array<{
      url: string;
      title?: string;
      publisher?: string;
      accessedAt?: string;
      retrievalQuery?: string;
      excerpt?: string;
    }>;
    publicationStatus?: "unpublished" | "published" | "rejected" | "needs_repair" | "not_recoverable";
    adminNote?: string | null;
  };
  if (body.questionText !== undefined && !body.questionText.trim()) {
    return Response.json({ error: "Question text cannot be empty" }, { status: 400 });
  }
  if (body.options !== undefined) {
    if (!Array.isArray(body.options) || body.options.length < 2) {
      return Response.json({ error: "At least two options are required" }, { status: 400 });
    }
    const labels = new Set<string>();
    for (const option of body.options) {
      const label = option.label?.trim().toUpperCase();
      if (!label || !option.text?.trim()) {
        return Response.json({ error: "Option label and text are required" }, { status: 400 });
      }
      if (labels.has(label)) {
        return Response.json({ error: "Option labels must be unique" }, { status: 400 });
      }
      labels.add(label);
    }
  }
  const question = await updateQuestionReview(id, body, user.email);
  if (!question) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }
  return Response.json({ question });
}
