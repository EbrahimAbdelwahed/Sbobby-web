"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useId } from "react";

type MobileStudyAnnouncementProps = {
  open: boolean;
  onDismiss: () => void;
};

export function MobileStudyAnnouncement({ open, onDismiss }: MobileStudyAnnouncementProps) {
  const descriptionId = useId();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onDismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sb-dialog-overlay" />
        <Dialog.Content className="sb-mobile-announcement-dialog" aria-describedby={descriptionId}>
          <div className="sb-mobile-announcement-header">
            <div>
              <Dialog.Title className="sb-mobile-announcement-title">Studio mobile disponibile</Dialog.Title>
              <Dialog.Description className="sb-mobile-announcement-description" id={descriptionId}>
                C&apos;e una nuova web app pensata per macinare MCQ dal telefono con meno rumore visivo.
              </Dialog.Description>
            </div>
            <Dialog.Close className="sb-dialog-close" aria-label="Chiudi avviso mobile">
              <span aria-hidden="true">&times;</span>
            </Dialog.Close>
          </div>

          <div className="sb-mobile-announcement-body">
            <div className="sb-mobile-announcement-note">
              Aprila una volta dal telefono, poi usa il menu Condividi o il menu del browser e scegli &quot;Aggiungi alla schermata Home&quot;.
            </div>

            <ul className="sb-mobile-announcement-list">
              <li>Scegli materia, argomento e numero di domande.</li>
              <li>Rispondi, skippa, leggi la spiegazione o segnala una card.</li>
              <li>Usa la stessa base dati del dashboard, senza sidebar e pannelli extra.</li>
            </ul>
          </div>

          <div className="sb-mobile-announcement-footer">
            <Dialog.Close className="sb-button-secondary">Non ora</Dialog.Close>
            <Link className="sb-action-primary" href="/mobile-study" onClick={onDismiss}>
              Apri studio mobile
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
