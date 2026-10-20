"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

const MIN_PASSWORD = 8;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [setup, setSetup] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => {
        // Already signed in on this device: go straight to the app.
        if (d.signedIn) {
          const next = params.get("next");
          router.replace(next && next.startsWith("/") ? next : "/");
          return;
        }
        setSetup(Boolean(d.setup));
      })
      .catch(() => setSetup(false));
  }, [params, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (setup && password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (setup && password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError("");
    const res = await fetch(setup ? "/api/auth/setup" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } else if (res?.status === 409) {
      setSetup(false);
      setError("A password was already created. Sign in with it.");
    } else {
      const msg = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : null;
      setError(res ? (setup ? (msg ?? "Couldn't save the password.") : "That password didn't match.") : "Can't reach the server.");
    }
  }

  if (setup === null) return <Loader2 className="size-6 animate-spin text-muted" />;

  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-5 p-7">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="size-12" />
        <div>
          <h1 className="text-xl font-semibold">{setup ? "Welcome to Momentum" : "Welcome back"}</h1>
          <p className="text-sm text-muted">{setup ? "Create the password you'll use to sign in." : "Small tasks, big goals."}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <label htmlFor="pw" className="label">
            {setup ? "New password" : "Password"}
          </label>
          <input
            id="pw"
            type="password"
            autoFocus
            autoComplete={setup ? "new-password" : "current-password"}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {setup && (
          <div>
            <label htmlFor="pw2" className="label">
              Confirm password
            </label>
            <input id="pw2" type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <p className="mt-1.5 text-xs text-muted">At least {MIN_PASSWORD} characters. You can change it later in Settings.</p>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
      <button className="btn-primary w-full" disabled={busy || !password || (setup && !confirm)}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            {setup ? "Create password" : "Sign in"} <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
