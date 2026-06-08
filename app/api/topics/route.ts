import type { NextRequest } from "next/server";

import { getTopicTree, getTopics } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const subject = request.nextUrl.searchParams.get("subject");
  const [topics, tree] = await Promise.all([getTopics(subject), getTopicTree(subject)]);
  return Response.json({
    topics,
    tree,
  });
}
