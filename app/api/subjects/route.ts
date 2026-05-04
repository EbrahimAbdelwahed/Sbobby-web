import { getSubjects } from "@/lib/exam/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ subjects: await getSubjects() });
}
