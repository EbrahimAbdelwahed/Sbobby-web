import { getAuthUser, isAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  return Response.json({
    isAdmin: await isAdminUser(user),
    user,
  });
}
