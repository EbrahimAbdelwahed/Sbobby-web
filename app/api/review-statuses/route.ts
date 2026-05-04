import { getReviewStatuses } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ reviewStatuses: await getReviewStatuses() });
}
