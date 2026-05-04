"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface VaultContextValue {
  handle: FileSystemDirectoryHandle | null;
  setHandle: (h: FileSystemDirectoryHandle | null) => void;
  isReady: boolean;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);

  return (
    <VaultContext.Provider value={{ handle, setHandle, isReady: handle !== null }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVaultContext() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVaultContext must be used within VaultProvider");
  return ctx;
}
