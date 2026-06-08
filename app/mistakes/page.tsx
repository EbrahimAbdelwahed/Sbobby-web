import { PageHeader } from "@/components/app/PageHeader";
import { SearchPageClient } from "@/components/search/SearchPageClient";

export const dynamic = "force-dynamic";

export default function MistakesPage() {
  return (
    <main className="sb-page">
      <div className="sb-shell">
        <PageHeader
          kicker="Errori"
          title="Rivedi domande sbagliate o parziali"
          description="Mostra solo le domande con almeno una risposta sbagliata o parziale registrata, con gli stessi filtri della ricerca reale."
        />
        <SearchPageClient initialStatus="wrong" fixedStatus />
      </div>
    </main>
  );
}
