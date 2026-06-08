import { SharedStudyApp } from "@/components/study/SharedStudyApp";

export const dynamic = "force-dynamic";

export default async function SharedStudyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SharedStudyApp code={code.toUpperCase()} />;
}
