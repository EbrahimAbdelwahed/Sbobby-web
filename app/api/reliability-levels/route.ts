import { getReliabilityLevels } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ reliabilityLevels: await getReliabilityLevels() });
}
