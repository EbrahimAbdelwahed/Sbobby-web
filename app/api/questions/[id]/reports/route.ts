import type { NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth";
import { createCardReport } from "@/lib/exam/repository";
import type { CardReportReason } from "@/lib/exam/types";

export const dynamic = "force-dynamic";

const reasons = new Set<CardReportReason>([
  "formatting_text",
  "wrong_answer",
  "wrong_exam_program",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    reason?: CardReportReason;
    note?: string;
  };

  if (!body.reason || !reasons.has(body.reason)) {
    return Response.json({ error: "Invalid report reason" }, { status: 400 });
  }

  const report = await createCardReport({
    questionId: id,
    userId: user.email,
    reason: body.reason,
    note: body.note,
  });

  return Response.json({ report });
}
