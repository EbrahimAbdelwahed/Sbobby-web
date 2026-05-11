import { getAuthUser } from "@/lib/auth";
import { getSubjects, getTopicTree, getTopics } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const [user, subjects, topics, tree] = await Promise.all([
    getAuthUser(),
    getSubjects(),
    getTopics(),
    getTopicTree(),
  ]);
  return Response.json({
    user,
    subjects,
    topics,
    tree,
  });
}
