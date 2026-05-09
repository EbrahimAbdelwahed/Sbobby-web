import { getAuthUser } from "@/lib/auth";
import { getSharedStudyAssignments } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { code } = await params;
  const assignments = await getSharedStudyAssignments(code, user.email);
  if (!assignments) {
    return Response.json({ error: "Shared session not found" }, { status: 404 });
  }
  return Response.json({ assignments });
}
