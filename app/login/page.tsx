"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="min-h-screen px-5 py-8 md:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--sb-text-dim)]">
            Exam flashcards
          </p>
          <h1 className="mt-3 text-4xl font-semibold">Sbobby</h1>
        </div>
        <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-5">
          <button
            className="w-full rounded-md bg-[var(--sb-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
