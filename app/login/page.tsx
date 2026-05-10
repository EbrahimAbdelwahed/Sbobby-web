"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="sb-page px-5 py-8 md:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="mb-8">
          <p className="sb-kicker">
            Exam flashcards
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-normal text-[var(--sb-text)]">Sbobby</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--sb-text-dim)]">
            Accedi per studiare le card pubblicate e gestire le sessioni condivise.
          </p>
        </div>
        <div className="sb-panel p-5">
          <button
            className="sb-action-primary w-full"
            onClick={() => signIn("google", { callbackUrl: "/studio" })}
            type="button"
          >
            Entra con Google
          </button>
        </div>
      </section>
    </main>
  );
}
