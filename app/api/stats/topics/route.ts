import { getAuthUser } from "@/lib/auth";
import { getLargestTopicClusters, getSubjectStats, getTopicStats } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    subjects: await getSubjectStats(user.email),
    topics: await getTopicStats(user.email),
    clusters: await getLargestTopicClusters(user.email),
  });
}
