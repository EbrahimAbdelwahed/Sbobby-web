"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useId, useState } from "react";

type JoinErrorKind = "code" | "auth" | "not-found" | "server";

type JoinError = {
  kind: JoinErrorKind;
  message: string;
};

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export function SharedSessionJoinForm() {
  const router = useRouter();
  const inputId = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<JoinError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = normalizeCode(code);
    setCode(normalizedCode);

    if (!normalizedCode) {
      setError({ kind: "code", message: "Inserisci il codice della sessione." });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/shared-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode }),
      });

      if (response.ok) {
        router.push(`/study/shared/${encodeURIComponent(normalizedCode)}`);
        return;
      }

      if (response.status === 401) {
        setError({
          kind: "auth",
          message: "Devi accedere prima di entrare in una sessione condivisa.",
        });
        return;
      }

      if (response.status === 400 || response.status === 404) {
        setError({
          kind: "not-found",
          message: "Codice non valido o sessione non trovata.",
        });
        return;
      }

      setError({ kind: "server", message: "Impossibile entrare nella sessione. Riprova." });
    } catch {
      setError({ kind: "server", message: "Connessione non riuscita. Riprova." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="sb-panel p-5" onSubmit={submit}>
      <label className="sb-label" htmlFor={inputId}>
        Codice sessione
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          autoCapitalize="characters"
          autoComplete="off"
          className="sb-input font-mono uppercase tracking-normal"
          id={inputId}
          inputMode="text"
          maxLength={12}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            if (error?.kind === "code" || error?.kind === "not-found") setError(null);
          }}
          placeholder="ABCD12"
          value={code}
        />
        <button className="sb-action-primary shrink-0" disabled={submitting} type="submit">
          {submitting ? "Ingresso..." : "Entra"}
        </button>
      </div>
      {error ? (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          <p>{error.message}</p>
          {error.kind === "auth" ? (
            <Link className="mt-2 inline-flex font-semibold text-rose-800 underline" href="/login">
              Vai al login
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-[var(--sb-text-dim)]">
          Usa il codice ricevuto dal docente o dal gruppo di studio.
        </p>
      )}
    </form>
  );
}
