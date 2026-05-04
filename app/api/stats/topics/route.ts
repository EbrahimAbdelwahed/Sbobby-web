import { getAuthUser } from "@/lib/auth";
import { getTopicStats } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    topics: await getTopicStats(user.email),
  });
}
