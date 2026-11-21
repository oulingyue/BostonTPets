import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { IS_PREVIEW, previewAuth } from './preview';
import { supabase } from './supabase';

type SessionState = { session: Session | null; isLoading: boolean };

const SessionContext = createContext<SessionState>({ session: null, isLoading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: true });

  useEffect(() => {
    if (IS_PREVIEW) {
      setState({ session: previewAuth.get(), isLoading: false });
      return previewAuth.subscribe((session) => setState({ session, isLoading: false }));
    }
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, isLoading: false }));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setState({ session, isLoading: false }),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

export async function signIn(email: string, password: string) {
  if (IS_PREVIEW) return previewAuth.signIn();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Returns true if the user is signed in immediately, false if they must confirm their email first. */
export async function signUp(email: string, password: string, displayName: string) {
  if (IS_PREVIEW) {
    previewAuth.signIn();
    return true;
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return data.session !== null;
}

export async function signOut() {
  if (IS_PREVIEW) return previewAuth.signOut();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
