import { getAuthUser, isAdminUser } from "@/lib/auth";
import { getReviewQueue } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user || !(await isAdminUser(user))) {
    return Response.json({ error: "Forbidden" }, { status: user ? 403 : 401 });
  }
  return Response.json({
    questions: await getReviewQueue(user.email),
  });
}
