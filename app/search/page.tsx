import { PageHeader } from "@/components/app/PageHeader";
import { SearchPageClient } from "@/components/search/SearchPageClient";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  return (
    <main className="sb-page">
      <div className="sb-shell">
        <PageHeader
          kicker="Cerca"
          title="Trova domande per dettaglio clinico, argomento o risposta"
          description="La ricerca lavora sulle domande pubblicate di Sbobby, includendo risposte, spiegazioni, argomenti, fonti e cronologia di revisione."
        />
        <SearchPageClient />
      </div>
    </main>
  );
}
