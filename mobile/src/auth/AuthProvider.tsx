import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { router } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { setOwned, setWished } from "../api/cards";

export type PendingAction = { type: "own" | "wish"; cardId: string; value: boolean };

interface AuthState {
  session: Session | null;
  ready: boolean;
  /** Bumped whenever user-specific data may have changed (login/logout, pending action applied). */
  dataVersion: number;
  bumpData: () => void;
  /** Guests are redirected to login; the action is applied automatically after a successful login (FR-GATE-01). */
  requireLogin: (pending?: PendingAction) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const pending = useRef<PendingAction | null>(null);

  const bumpData = useCallback(() => setDataVersion((v) => v + 1), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_IN") {
        const action = pending.current;
        pending.current = null;
        if (action) {
          const run = action.type === "own" ? setOwned : setWished;
          // Defer so the auth callback is not blocked by a network call.
          setTimeout(() => {
            run(action.cardId, action.value).finally(() => setDataVersion((v) => v + 1));
          }, 0);
        }
      }
      setDataVersion((v) => v + 1);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const requireLogin = useCallback((action?: PendingAction) => {
    pending.current = action ?? null;
    router.push("/login");
  }, []);

  const value = useMemo(
    () => ({ session, ready, dataVersion, bumpData, requireLogin }),
    [session, ready, dataVersion, bumpData, requireLogin],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
