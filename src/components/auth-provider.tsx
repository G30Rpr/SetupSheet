"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithDiscord: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: ReactNode;
}) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(initialUser);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(initialUser === null);

  useEffect(() => {
    // Reconciles the server-rendered user with the real client session, then
    // keeps both in sync as the user logs in/out or the token refreshes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setIsLoading(false);
      })
      .catch((error) => {
        // Keep the server-rendered user when a transient browser request
        // fails; an auth-network outage should not log a user out or leave
        // the header in its loading state forever.
        logger.error("AuthProvider: failed to load browser session", error);
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      async signInWithDiscord() {
        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "discord",
            options: {
              redirectTo: `${window.location.origin}/auth/callback`,
            },
          });
          if (error) logger.error("AuthProvider: Discord sign-in failed", error);
        } catch (error) {
          logger.error("AuthProvider: Discord sign-in failed", error);
        }
      },
      async signOut() {
        try {
          const { error } = await supabase.auth.signOut();
          if (error) logger.error("AuthProvider: sign-out failed", error);
        } catch (error) {
          logger.error("AuthProvider: sign-out failed", error);
        }
      },
    }),
    [supabase, user, session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
