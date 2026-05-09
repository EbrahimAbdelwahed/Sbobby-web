import { SharedReviewApp } from "@/components/study/SharedStudyApp";

export const dynamic = "force-dynamic";

export default async function SharedStudyReviewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SharedReviewApp code={code.toUpperCase()} />;
}
