import { Suspense } from "react";
import LoginPage from "./login-client";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
          Loading…
        </main>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
