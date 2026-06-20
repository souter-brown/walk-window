import type { Metadata } from "next";
import { AppFooter } from "@/components/AppFooter";
import { RunPaceMission } from "@/components/RunPaceMission";

export const metadata: Metadata = {
  title: "Run Pace Mission",
  description:
    "Plan a weather-adjusted running pace based on expected end-of-run conditions.",
};

export default function RunPaceMissionPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-gradient-to-br from-sky-300 via-sky-200 to-sky-400">
      <RunPaceMission />
      <AppFooter />
    </main>
  );
}
