import { PageHeader } from "@/components/app/PageHeader";
import { SearchPageClient } from "@/components/search/SearchPageClient";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <main className="sb-page">
      <div className="sb-shell">
        <PageHeader
          kicker="Search"
          title="Find cards by clinical detail, topic, or answer"
          description="Search runs against the published Sbobby question set, including answers, explanations, topics, source labels, and your review history."
        />
        <SearchPageClient />
      </div>
    </main>
  );
}
