import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useStore } from '../store';

interface AuthContextType {
  user: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useStore((s) => s.user);
  const loading = useStore((s) => s.loading);
  const loadUser = useStore((s) => s.loadUser);
  const signIn = useStore((s) => s.signIn);
  const signUp = useStore((s) => s.signUp);
  const signOut = useStore((s) => s.signOut);

  useEffect(() => { loadUser(); }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
