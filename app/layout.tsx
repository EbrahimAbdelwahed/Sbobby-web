import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sbobby",
  description: "Study smarter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className="h-full">
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
