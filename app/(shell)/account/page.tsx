"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWatchNext } from "@/hooks/use-watchnext";

export default function AccountPage() {
  const {
    isGuest,
    supabaseConfigured,
    signIn,
    signUp,
    signOut,
    deleteLocalSession,
    continueAsGuest,
  } = useWatchNext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Account action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
      <div>
        <p className="text-xs tracking-[0.25em] text-violet-300 uppercase">
          Account
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No billing. Guest demo works without email. Local Auth is optional.
        </p>
      </div>
      {!supabaseConfigured ? (
        <p className="rounded-2xl border border-white/10 p-4 text-sm text-muted-foreground">
          Supabase is not configured. You can still use a local guest session.
        </p>
      ) : (
        <form
          className="space-y-3 rounded-2xl border border-white/10 p-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              className="h-11"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              className="h-11"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              disabled={busy}
              onClick={() =>
                void run(() => signIn(email, password), "Signed in.")
              }
            >
              Sign in
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onClick={() =>
                void run(() => signUp(email, password), "Account created.")
              }
            >
              Sign up
            </Button>
          </div>
        </form>
      )}
      <div className="flex flex-col gap-2">
        {!isGuest ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void run(signOut, "Signed out.")}
          >
            Sign out
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void run(continueAsGuest, "Continuing as guest.")}
          >
            Continue as guest
          </Button>
        )}
        <Button
          type="button"
          variant="destructive"
          disabled={busy}
          onClick={() =>
            void run(deleteLocalSession, "Local session deleted.")
          }
        >
          Delete local session
        </Button>
      </div>
    </main>
  );
}
