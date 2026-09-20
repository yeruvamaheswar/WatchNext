"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  clearGuest,
  emptyGuest,
  GUEST_SSR,
  loadGuest,
  dropMark,
  hasMark,
  rememberSeenOnboarding,
  removeLike,
  saveGuest,
  toggleMark,
  upsertLike,
} from "@/lib/guest-store";
import { getPublicEnv } from "@/lib/public-env";
import { supabaseFetchTimeoutMs } from "@/lib/supabase/timeout";
import { abortableFetch, withTimeout } from "@/lib/with-timeout";
import {
  fetchRemoteUserState,
  isPersistedUserId,
  mergeUserState,
  saveRemoteUserState,
  shouldPushLocal,
} from "@/lib/user-state";
import type { GuestLike, GuestState, TitleMark } from "@/lib/types";

type WatchNextValue = {
  ready: boolean;
  guest: GuestState;
  session: Session | null;
  userId: string;
  isGuest: boolean;
  supabaseConfigured: boolean;
  setGuest: (next: GuestState) => void;
  recordVerdict: (like: GuestLike) => void;
  removeLikedTitle: (mark: TitleMark) => void;
  setVibeVerdict: (id: string, liked: boolean) => void;
  toggleWatchlist: (mark: TitleMark) => void;
  toggleSeen: (mark: TitleMark) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => void;
  rememberOnboardingDeck: (seen: {
    movieIds: number[];
    showIds: number[];
    vibeIds: string[];
  }) => void;
  setDisplayName: (name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteLocalSession: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
};

const WatchNextContext = createContext<WatchNextValue | null>(null);

let cachedReady = false;
let cachedGuest: GuestState | null = null;
let cachedSession: Session | null = null;

export function WatchNextProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(cachedReady);
  const [guest, setGuestState] = useState<GuestState>(cachedGuest ?? GUEST_SSR);
  const [session, setSession] = useState<Session | null>(cachedSession);
  const publicEnv = getPublicEnv();
  const supabaseConfigured = publicEnv.hasSupabase;
  const supabaseTimeout = supabaseFetchTimeoutMs(publicEnv.supabaseUrl);
  const guestRef = useRef(guest);
  const sessionRef = useRef(session);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tasteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedUserRef = useRef("");
  guestRef.current = guest;
  sessionRef.current = session;
  cachedReady = ready;
  cachedGuest = ready ? guest : cachedGuest;
  cachedSession = session;

  const updateGuest = useCallback((updater: (prev: GuestState) => GuestState) => {
    let next = guestRef.current;
    setGuestState((prev) => {
      next = updater(prev);
      saveGuest(next);
      guestRef.current = next;
      return next;
    });
    return next;
  }, []);

  const setGuest = useCallback(
    (next: GuestState) => {
      updateGuest(() => next);
    },
    [updateGuest]
  );

  const persistLists = useCallback(
    async (state: GuestState, extra: { onboardingComplete?: boolean } = {}) => {
      const id = sessionRef.current?.user.id ?? state.guestId;
      if (!supabaseConfigured || !isPersistedUserId(id)) {
        return { ok: true, persisted: false };
      }
      return saveRemoteUserState(
        {
          userId: id,
          displayName: state.displayName,
          isGuest: !sessionRef.current || Boolean(sessionRef.current.user.is_anonymous),
          likes: state.likes,
          likedVibes: state.likedVibes,
          watchlist: state.watchlist,
          seen: state.seen,
          onboardingComplete: extra.onboardingComplete ?? state.onboardingComplete,
        },
        supabaseTimeout
      );
    },
    [supabaseConfigured, supabaseTimeout]
  );

  const schedulePersistLists = useCallback(
    (state: GuestState) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void persistLists(state).catch(() => {});
      }, 400);
    },
    [persistLists]
  );

  const scheduleTasteRefresh = useCallback(
    (state: GuestState) => {
      if (!state.onboardingComplete) return;
      if (tasteTimer.current) clearTimeout(tasteTimer.current);
      tasteTimer.current = setTimeout(() => {
        const id = sessionRef.current?.user.id ?? state.guestId;
        if (!isPersistedUserId(id)) return;
        void abortableFetch(
          "/api/taste/recompute",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: id,
              likes: state.likes,
              likedVibes: state.likedVibes,
              displayName: state.displayName,
              isGuest: !sessionRef.current || Boolean(sessionRef.current.user.is_anonymous),
            }),
          },
          supabaseTimeout + 10_000
        ).catch(() => {});
      }, 800);
    },
    [supabaseTimeout]
  );

  const persistTaste = useCallback(
    async (state: GuestState, id: string, guestFlag: boolean) => {
      try {
        await persistLists(state, { onboardingComplete: true });
        if (!isPersistedUserId(id)) return;
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
          supabaseTimeout + 10_000
        );
      } catch {
        // Local guest taste still counts.
      }
    },
    [persistLists, supabaseTimeout]
  );

  useEffect(() => {
    let cancelled = false;
    let supabase = null as ReturnType<typeof createBrowserSupabase>;
    try {
      supabase = createBrowserSupabase();
    } catch {
      supabase = null;
    }

    let local = emptyGuest();
    try {
      local = loadGuest();
    } catch {
      local = emptyGuest();
    }
    setGuestState(local);
    guestRef.current = local;

    const hydrate = async (userId: string) => {
      if (cancelled || !isPersistedUserId(userId)) return;
      try {
        const remote = await fetchRemoteUserState(userId, supabaseTimeout);
        if (cancelled) return;
        const local = guestRef.current;
        const merged = mergeUserState(local, remote, userId);
        updateGuest(() => merged);
        hydratedUserRef.current = userId;
        if (shouldPushLocal(local, remote)) {
          void persistLists(merged).catch(() => {});
        }
      } catch {
        updateGuest((prev) => ({ ...prev, guestId: userId || prev.guestId }));
      }
    };

    void (async () => {
      if (!supabase) {
        await hydrate(local.guestId);
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const { data } = await withTimeout(supabase.auth.getSession(), supabaseTimeout);
        if (cancelled) return;
        let nextSession = data.session;
        if (!nextSession) {
          const anon = await withTimeout(
            supabase.auth.signInAnonymously(),
            supabaseTimeout
          );
          if (!anon.error && anon.data.session) nextSession = anon.data.session;
        }
        if (cancelled) return;
        setSession(nextSession);
        sessionRef.current = nextSession;
        await hydrate(nextSession?.user.id || local.guestId);
      } catch {
        // Local guest session is enough when Auth is down.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    const sub = supabase?.auth.onAuthStateChange((event, next) => {
      if (cancelled) return;
      setSession(next);
      sessionRef.current = next;
      if (
        next &&
        (event === "SIGNED_IN" || event === "USER_UPDATED") &&
        next.user.id !== hydratedUserRef.current
      ) {
        void hydrate(next.user.id);
      }
    });

    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
      if (persistTimer.current) clearTimeout(persistTimer.current);
      if (tasteTimer.current) clearTimeout(tasteTimer.current);
    };
  }, [persistLists, supabaseTimeout, updateGuest]);

  const userId = session?.user.id ?? guest.guestId;
  const isGuest = !session || Boolean(session.user.is_anonymous);

  const recordVerdict = useCallback(
    (like: GuestLike) => {
      const next = updateGuest((prev) => ({
        ...prev,
        likes: upsertLike(prev.likes, like),
      }));
      schedulePersistLists(next);
      scheduleTasteRefresh(next);
    },
    [schedulePersistLists, scheduleTasteRefresh, updateGuest]
  );

  const removeLikedTitle = useCallback(
    (mark: TitleMark) => {
      const next = updateGuest((prev) => ({
        ...prev,
        likes: removeLike(prev.likes, mark),
      }));
      schedulePersistLists(next);
      scheduleTasteRefresh(next);
    },
    [schedulePersistLists, scheduleTasteRefresh, updateGuest]
  );

  const setVibeVerdict = useCallback(
    (id: string, liked: boolean) => {
      const next = updateGuest((prev) => {
        const likedVibes = liked
          ? [...new Set([...prev.likedVibes.filter((v) => v !== id), id])]
          : prev.likedVibes.filter((v) => v !== id);
        const dislikedVibes = liked
          ? prev.dislikedVibes.filter((v) => v !== id)
          : [...new Set([...prev.dislikedVibes.filter((v) => v !== id), id])];
        return { ...prev, likedVibes, dislikedVibes };
      });
      schedulePersistLists(next);
    },
    [schedulePersistLists, updateGuest]
  );

  const toggleWatchlist = useCallback(
    (mark: TitleMark) => {
      const next = updateGuest((prev) => {
        const watchlist = toggleMark(prev.watchlist ?? [], mark);
        return {
          ...prev,
          watchlist,
          seen: hasMark(watchlist, mark) ? dropMark(prev.seen, mark) : prev.seen,
        };
      });
      schedulePersistLists(next);
    },
    [schedulePersistLists, updateGuest]
  );

  const toggleSeen = useCallback(
    (mark: TitleMark) => {
      const next = updateGuest((prev) => {
        const seen = toggleMark(prev.seen ?? [], mark);
        return {
          ...prev,
          seen,
          watchlist: hasMark(seen, mark) ? dropMark(prev.watchlist, mark) : prev.watchlist,
        };
      });
      schedulePersistLists(next);
    },
    [schedulePersistLists, updateGuest]
  );

  const completeOnboarding = useCallback(async () => {
    const next = updateGuest((prev) => ({ ...prev, onboardingComplete: true }));
    const id = sessionRef.current?.user.id ?? next.guestId;
    const guestFlag = !sessionRef.current || Boolean(sessionRef.current.user.is_anonymous);
    await persistTaste(next, id || next.guestId, guestFlag);
  }, [persistTaste, updateGuest]);

  const resetOnboarding = useCallback(() => {
    const next = updateGuest((prev) => ({
      ...prev,
      onboardingComplete: false,
      likes: [],
      likedVibes: [],
      dislikedVibes: [],
    }));
    void persistLists(next, { onboardingComplete: false }).catch(() => {});
  }, [persistLists, updateGuest]);

  const rememberOnboardingDeck = useCallback(
    (seen: { movieIds: number[]; showIds: number[]; vibeIds: string[] }) => {
      updateGuest((prev) => ({
        ...prev,
        seenOnboarding: rememberSeenOnboarding(prev.seenOnboarding, seen),
      }));
    },
    [updateGuest]
  );

  const setDisplayName = useCallback(
    async (name: string) => {
      const trimmed = name.trim() || "Guest";
      const next = updateGuest((prev) => ({ ...prev, displayName: trimmed }));
      const id = sessionRef.current?.user.id ?? next.guestId;
      await persistLists(next).catch(() => {});
      if (!isPersistedUserId(id)) return;
      await abortableFetch(
        "/api/profile",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: id, displayName: trimmed }),
        },
        supabaseTimeout
      ).catch(() => {});
    },
    [persistLists, supabaseTimeout, updateGuest]
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = createBrowserSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      supabaseTimeout
    );
    if (error) throw error;
  }, [supabaseTimeout]);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = createBrowserSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: guestRef.current.displayName } },
      }),
      supabaseTimeout
    );
    if (error) throw error;
  }, [supabaseTimeout]);

  const signOut = useCallback(async () => {
    const supabase = createBrowserSupabase();
    try {
      if (supabase) await withTimeout(supabase.auth.signOut(), supabaseTimeout);
    } catch {
      // Local session still clears.
    }
    hydratedUserRef.current = "";
    setSession(null);
    sessionRef.current = null;
  }, [supabaseTimeout]);

  const deleteLocalSession = useCallback(async () => {
    const supabase = createBrowserSupabase();
    try {
      if (supabase) await withTimeout(supabase.auth.signOut(), supabaseTimeout);
    } catch {
      // Ignore unreachable Auth.
    }
    clearGuest();
    const fresh = emptyGuest();
    setGuestState(fresh);
    saveGuest(fresh);
    guestRef.current = fresh;
    hydratedUserRef.current = "";
    setSession(null);
    sessionRef.current = null;
  }, [supabaseTimeout]);

  const continueAsGuest = useCallback(async () => {
    const supabase = createBrowserSupabase();
    setSession(null);
    sessionRef.current = null;
    hydratedUserRef.current = "";
    if (!supabase) return;
    try {
      await withTimeout(supabase.auth.signOut(), supabaseTimeout);
    } catch {
      // Already local.
    }
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInAnonymously(),
        supabaseTimeout
      );
      if (!error && data.session) {
        setSession(data.session);
        sessionRef.current = data.session;
        const merged = mergeUserState(guestRef.current, null, data.session.user.id);
        updateGuest(() => merged);
        void persistLists(merged).catch(() => {});
      }
    } catch {
      // Stay on the local guest profile.
    }
  }, [persistLists, supabaseTimeout, updateGuest]);

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
      removeLikedTitle,
      setVibeVerdict,
      toggleWatchlist,
      toggleSeen,
      completeOnboarding,
      resetOnboarding,
      rememberOnboardingDeck,
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
      removeLikedTitle,
      setVibeVerdict,
      toggleWatchlist,
      toggleSeen,
      completeOnboarding,
      resetOnboarding,
      rememberOnboardingDeck,
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
