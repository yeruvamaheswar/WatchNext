import { AppShell } from "@/components/app-shell";
import { RequireOnboarding } from "@/components/require-onboarding";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireOnboarding>
      <AppShell>{children}</AppShell>
    </RequireOnboarding>
  );
}
