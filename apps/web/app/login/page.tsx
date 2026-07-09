"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/NavBar";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/_manage/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body: { error?: string } = await res
          .json()
          .catch(() => ({}) as { error?: string });
        setError(body.error ?? "Login failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <form
        onSubmit={onSubmit}
        className="card w-full max-w-sm animate-fade-up flex-col gap-4 p-7"
      >
        <div>
          <h1 className="text-xl font-bold text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-white/50">Sign in to manage your APIs.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-white/40">
            Admin password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="input"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={loading || !password} className="btn-primary w-full">
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-xs text-white/35">
          Self-hosting? The default password is{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/60">admin</code> unless you set{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/60">ADMIN_PASSWORD</code>.
        </p>
      </form>

      <Link href="/" className="mt-6 text-sm text-white/40 transition hover:text-white/70">
        ← Back to home
      </Link>
    </main>
  );
}
