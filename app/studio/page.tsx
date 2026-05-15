import { Suspense } from "react";

import { ExamStudioApp } from "@/components/studio/ExamStudioApp";

export default function StudioPage() {
  return (
    <Suspense fallback={<main className="sb-page px-5 py-6 text-sm text-[var(--sb-text-dim)]">Caricamento...</main>}>
      <ExamStudioApp />
    </Suspense>
  );
}
