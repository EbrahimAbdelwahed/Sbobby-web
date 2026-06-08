import Link from "next/link";

import { SharedSessionJoinForm } from "@/components/study/SharedSessionJoinForm";

export const dynamic = "force-dynamic";

export default function SharedSessionJoinPage() {
  return (
    <main className="sb-page">
      <div className="sb-shell max-w-[860px]">
        <header className="sb-header">
          <div>
            <p className="sb-kicker">Sessioni condivise</p>
            <h1 className="sb-title">Entra in una sessione</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--sb-text-dim)]">
              Inserisci il codice della sessione per studiare le stesse domande del gruppo.
            </p>
          </div>
          <Link className="sb-button-secondary" href="/studio">
            Torna allo studio
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
          <SharedSessionJoinForm />
          <aside className="sb-panel-flat h-fit p-4 text-sm leading-6 text-[var(--sb-text-dim)]">
            <h2 className="text-sm font-semibold text-[var(--sb-text)]">Prima di entrare</h2>
            <p className="mt-2">Il codice viene normalizzato in maiuscolo. Se la sessione non esiste, il codice resta nel campo per correggerlo.</p>
          </aside>
        </section>
      </div>
    </main>
  );
}
