import { AppFooter } from "@/components/AppFooter";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col bg-gradient-to-br from-sky-300 via-sky-200 to-sky-400">
      <Dashboard />
      <AppFooter />
    </main>
  );
}
