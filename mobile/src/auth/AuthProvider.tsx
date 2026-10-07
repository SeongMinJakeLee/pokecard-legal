import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { router } from "expo-router";
import * as Linking from "expo-linking";
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

/** Where Supabase redirects after email confirmation. Must be in the project's Redirect URLs allow-list. */
export const AUTH_REDIRECT_URL = "pokecard://auth/callback";

/** Reads tokens (implicit flow, in the #fragment) or a `code` (PKCE) from an auth deep link and stores the session. */
async function completeSessionFromUrl(url: string): Promise<void> {
  if (!url.startsWith("pokecard://auth/callback")) return;
  const hashIdx = url.indexOf("#");
  const queryIdx = url.indexOf("?");
  const parse = (s: string) => new URLSearchParams(s);
  const fragment = hashIdx >= 0 ? parse(url.slice(hashIdx + 1)) : new URLSearchParams();
  const query = queryIdx >= 0 ? parse(url.slice(queryIdx + 1, hashIdx >= 0 ? hashIdx : undefined)) : new URLSearchParams();

  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken && refreshToken) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return;
  }
  const code = query.get("code");
  if (code) await supabase.auth.exchangeCodeForSession(code);
}

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

  // Email-confirmation / magic links open the app via the `pokecard://auth/callback` deep link.
  useEffect(() => {
    const handle = (url: string | null) => {
      if (url) completeSessionFromUrl(url).catch(() => {});
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener("url", ({ url }) => handle(url));
    return () => sub.remove();
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
