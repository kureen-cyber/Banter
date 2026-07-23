"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  isFirebaseConfigured,
  signInPmWithEmail,
  signInPmWithGithub,
} from "@/lib/firebase/client";
import { getPmBaseUrl } from "@/lib/pm";

type Tab = "banter" | "pm";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const errorParam = params.get("error");

  const firebaseReady = useMemo(() => isFirebaseConfigured(), []);
  const [tab, setTab] = useState<Tab>(firebaseReady ? "pm" : "banter");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [githubHandle, setGithubHandle] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState<string | null>(
    errorParam === "pm_sso_failed"
      ? "PM handoff failed. Sign in below."
      : errorParam === "missing_pm_token"
        ? "Missing PM token. Sign in below."
        : null,
  );
  const [loading, setLoading] = useState(false);

  async function finishFirebaseSession(
    idToken: string,
    handle?: string | null,
  ) {
    const res = await fetch("/api/auth/firebase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        githubHandle: handle || githubHandle || null,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || "PM sign-in failed");
    router.push("/app");
    router.refresh();
  }

  async function onBanterSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          mode,
          displayName: email.split("@")[0],
          githubHandle: githubHandle || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not sign in.");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function onPmEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firebaseReady) {
      setMessage("Firebase env vars from the PM app are not configured yet.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const idToken = await signInPmWithEmail(email, password);
      await finishFirebaseSession(idToken, githubHandle || null);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "PM (Firebase) sign-in failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onPmGithub() {
    if (!firebaseReady) {
      setMessage("Firebase env vars from the PM app are not configured yet.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { idToken, githubHandle: gh } = await signInPmWithGithub();
      await finishFirebaseSession(idToken, gh || githubHandle || null);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "GitHub PM sign-in failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[0_20px_60px_-30px_rgba(21,34,56,0.45)] md:grid-cols-2">
        <section className="relative hidden bg-[var(--sidebar)] p-10 text-white md:flex md:flex-col md:justify-between">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, #2dd4bf33, transparent 40%), radial-gradient(circle at 80% 80%, #60a5fa33, transparent 35%)",
            }}
          />
          <div className="relative">
            <p className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
              Banter
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
              Sign in with your Banter account or the same Firebase login used
              by the PM tool. Link both with your GitHub handle.
            </p>
          </div>
          <div className="relative space-y-3 text-sm text-white/65">
            <p>Banter account · PM (Firebase) account</p>
            <p>GitHub handle bridges identity across both apps.</p>
          </div>
        </section>

        <section className="p-8 sm:p-10">
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            Welcome
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Choose how you want to sign in.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface)] p-1">
            <button
              type="button"
              onClick={() => setTab("pm")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === "pm"
                  ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--muted)]"
              }`}
            >
              PM account
            </button>
            <button
              type="button"
              onClick={() => setTab("banter")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === "banter"
                  ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--muted)]"
              }`}
            >
              Banter account
            </button>
          </div>

          {message && (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {message}
            </p>
          )}

          {tab === "pm" ? (
            <div className="mt-6 space-y-4">
              {!firebaseReady && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Add the PM Firebase <code>NEXT_PUBLIC_FIREBASE_*</code> keys
                  to <code>.env.local</code> to enable this tab.
                </p>
              )}
              <form onSubmit={onPmEmailSubmit} className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">
                    PM email
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">
                    PM password
                  </span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">
                    GitHub handle (optional link)
                  </span>
                  <input
                    value={githubHandle}
                    onChange={(e) => setGithubHandle(e.target.value)}
                    placeholder="kureen-cyber"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading || !firebaseReady}
                  className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? "Working…" : "Sign in with PM account"}
                </button>
              </form>
              <button
                type="button"
                disabled={loading || !firebaseReady}
                onClick={() => void onPmGithub()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface)] disabled:opacity-50"
              >
                <GitHubMark className="h-4 w-4" />
                Continue with GitHub (PM)
              </button>
              <a
                href={getPmBaseUrl()}
                className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Open PM tool <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <form onSubmit={onBanterSubmit} className="mt-6 space-y-4">
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-[var(--muted)]">
                  Password
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                />
              </label>
              {mode === "signup" && (
                <label className="block text-sm">
                  <span className="mb-1.5 block text-[var(--muted)]">
                    GitHub handle (links to PM)
                  </span>
                  <input
                    value={githubHandle}
                    onChange={(e) => setGithubHandle(e.target.value)}
                    placeholder="kureen-cyber"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                  />
                </label>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {loading
                  ? "Working…"
                  : mode === "signin"
                    ? "Sign in to Banter"
                    : "Create Banter account"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setMode((m) => (m === "signin" ? "signup" : "signin"))
                }
                className="text-sm text-[var(--accent)] hover:underline"
              >
                {mode === "signin"
                  ? "Need an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
