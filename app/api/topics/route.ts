import type { NextRequest } from "next/server";

import { getTopics } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return Response.json({
    topics: await getTopics(request.nextUrl.searchParams.get("subject")),
  });
}
