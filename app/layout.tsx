import type { Metadata } from "next";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
