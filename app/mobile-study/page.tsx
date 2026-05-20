import type { Metadata } from "next";

import { MobileStudyApp } from "@/components/mobile-study/MobileStudyApp";

export const metadata: Metadata = {
  title: "Sbobby Mobile Study",
  description: "Studio MCQ rapido e mobile-first per Sbobby.",
  appleWebApp: {
    capable: true,
    title: "Sbobby",
    statusBarStyle: "default",
  },
};

export default function MobileStudyPage() {
  return <MobileStudyApp />;
}
