import { getAuthUser, isAdminUser } from "@/lib/auth";
import { getAdminQuestionList } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

const modes = new Set(["queue", "published", "unpublished"]);

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user || !(await isAdminUser(user))) {
    return Response.json({ error: "Forbidden" }, { status: user ? 403 : 401 });
  }
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  return Response.json({
    questions: await getAdminQuestionList(user.email, {
      mode: mode && modes.has(mode) ? (mode as "queue" | "published" | "unpublished") : "queue",
      q: url.searchParams.get("q"),
      limit: Number(url.searchParams.get("limit") ?? 100),
    }),
  });
}
