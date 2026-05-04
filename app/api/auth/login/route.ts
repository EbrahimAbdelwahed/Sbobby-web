export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json(
    { error: "Use Google OAuth at /api/auth/signin/google" },
    { status: 410 },
  );
}
