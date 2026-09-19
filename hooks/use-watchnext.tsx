"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  clearGuest,
  emptyGuest,
  GUEST_SSR,
  loadGuest,
  saveGuest,
  upsertLike,
} from "@/lib/guest-store";
import { getPublicEnv } from "@/lib/env";
import { abortableFetch, withTimeout } from "@/lib/with-timeout";
import type { GuestLike, GuestState } from "@/lib/types";

type WatchNextValue = {
  ready: boolean;
  guest: GuestState;
  session: Session | null;
  userId: string;
  isGuest: boolean;
  supabaseConfigured: boolean;
  setGuest: (next: GuestState) => void;
  recordVerdict: (like: GuestLike) => void;
  setVibeVerdict: (id: string, liked: boolean) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => void;
  setDisplayName: (name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteLocalSession: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
};

const WatchNextContext = createContext<WatchNextValue | null>(null);

export function WatchNextProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [guest, setGuestState] = useState<GuestState>(GUEST_SSR);
  const [session, setSession] = useState<Session | null>(null);
  const supabaseConfigured = getPublicEnv().hasSupabase;

  const setGuest = useCallback((next: GuestState) => {
    setGuestState(next);
    saveGuest(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabase();

    const boot = () => {
      if (cancelled) return;
      setGuestState(loadGuest());
      setReady(true);

      if (!supabase) return;
      void (async () => {
        try {
          const { data } = await withTimeout(supabase.auth.getSession(), 2000);
          if (cancelled) return;
          if (data.session) {
            setSession(data.session);
            return;
          }
          const anon = await withTimeout(supabase.auth.signInAnonymously(), 2000);
          if (!cancelled && !anon.error && anon.data.session) {
            setSession(anon.data.session);
          }
        } catch {
          // Local guest session is enough when Auth is down.
        }
      })();
    };

    const id = window.setTimeout(boot, 0);
    const sub = supabase?.auth.onAuthStateChange((_event, next) => {
      if (!cancelled) setSession(next);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(id);
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? guest.guestId;
  const isGuest = !session || Boolean(session.user.is_anonymous);

  const recordVerdict = useCallback(
    (like: GuestLike) => {
      setGuest({ ...guest, likes: upsertLike(guest.likes, like) });
    },
    [guest, setGuest]
  );

  const setVibeVerdict = useCallback(
    (id: string, liked: boolean) => {
      const likedVibes = liked
        ? [...new Set([...guest.likedVibes.filter((v) => v !== id), id])]
        : guest.likedVibes.filter((v) => v !== id);
      const dislikedVibes = liked
        ? guest.dislikedVibes.filter((v) => v !== id)
        : [...new Set([...guest.dislikedVibes.filter((v) => v !== id), id])];
      setGuest({ ...guest, likedVibes, dislikedVibes });
    },
    [guest, setGuest]
  );

  const persistTaste = useCallback(
    async (state: GuestState, id: string, guestFlag: boolean) => {
      try {
        await abortableFetch(
          "/api/onboarding/complete",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: id,
              displayName: state.displayName,
              isGuest: guestFlag,
              likes: state.likes,
              likedVibes: state.likedVibes,
            }),
          },
          2500
        );
      } catch {
        // Local guest taste still counts.
      }
    },
    []
  );

  const completeOnboarding = useCallback(async () => {
    const next = { ...guest, onboardingComplete: true };
    setGuest(next);
    void persistTaste(next, userId || next.guestId, isGuest);
  }, [guest, isGuest, persistTaste, setGuest, userId]);

  const resetOnboarding = useCallback(() => {
    setGuest({
      ...guest,
      onboardingComplete: false,
      likes: [],
      likedVibes: [],
      dislikedVibes: [],
    });
  }, [guest, setGuest]);

  const setDisplayName = useCallback(
    async (name: string) => {
      const trimmed = name.trim() || "Guest";
      setGuest({ ...guest, displayName: trimmed });
      await abortableFetch(
        "/api/profile",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, displayName: trimmed }),
        },
        2500
      ).catch(() => {});
    },
    [guest, setGuest, userId]
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = createBrowserSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      4000
    );
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = createBrowserSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: guest.displayName } },
      }),
      4000
    );
    if (error) throw error;
  }, [guest.displayName]);

  const signOut = useCallback(async () => {
    const supabase = createBrowserSupabase();
    try {
      if (supabase) await withTimeout(supabase.auth.signOut(), 2000);
    } catch {
      // Local session still clears.
    }
    setSession(null);
  }, []);

  const deleteLocalSession = useCallback(async () => {
    const supabase = createBrowserSupabase();
    try {
      if (supabase) await withTimeout(supabase.auth.signOut(), 2000);
    } catch {
      // Ignore unreachable Auth.
    }
    clearGuest();
    const fresh = emptyGuest();
    setGuestState(fresh);
    saveGuest(fresh);
    setSession(null);
  }, []);

  const continueAsGuest = useCallback(async () => {
    const supabase = createBrowserSupabase();
    setSession(null);
    if (!supabase) return;
    try {
      await withTimeout(supabase.auth.signOut(), 2000);
    } catch {
      // Already local.
    }
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInAnonymously(),
        2000
      );
      if (!error && data.session) setSession(data.session);
    } catch {
      // Stay on the local guest profile.
    }
  }, []);

  const value = useMemo(
    () => ({
      ready,
      guest,
      session,
      userId,
      isGuest,
      supabaseConfigured,
      setGuest,
      recordVerdict,
      setVibeVerdict,
      completeOnboarding,
      resetOnboarding,
      setDisplayName,
      signIn,
      signUp,
      signOut,
      deleteLocalSession,
      continueAsGuest,
    }),
    [
      ready,
      guest,
      session,
      userId,
      isGuest,
      supabaseConfigured,
      setGuest,
      recordVerdict,
      setVibeVerdict,
      completeOnboarding,
      resetOnboarding,
      setDisplayName,
      signIn,
      signUp,
      signOut,
      deleteLocalSession,
      continueAsGuest,
    ]
  );

  return (
    <WatchNextContext.Provider value={value}>{children}</WatchNextContext.Provider>
  );
}

export function useWatchNext() {
  const ctx = useContext(WatchNextContext);
  if (!ctx) throw new Error("useWatchNext must be used within WatchNextProvider");
  return ctx;
}
