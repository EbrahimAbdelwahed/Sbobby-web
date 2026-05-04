import { getDatabaseStatus } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    database: await getDatabaseStatus(),
  });
}
