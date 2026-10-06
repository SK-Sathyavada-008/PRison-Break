// ─────────────────────────────────────────────
// Auth Context — Admin Authentication State
// ─────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, type AdminUser } from '../services/authService';
import { isFirebaseConfigured } from '../config/firebase';

export interface AuthContextType {
  currentUser: AdminUser | null;
  user: AdminUser | null; // Alias for backward compatibility
  loading: boolean;
  isAuthenticated: boolean;
  isFirebaseReady: boolean;
  login: (identifier: string, pass: string) => Promise<AdminUser>;
  loginDemo: () => AdminUser;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isFirebaseReady = isFirebaseConfigured();

  useEffect(() => {
    const unsub = authService.onAuthStateChanged((adminUser) => {
      setCurrentUser(adminUser);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const login = async (identifier: string, pass: string): Promise<AdminUser> => {
    setLoading(true);
    try {
      const loggedIn = await authService.signIn(identifier, pass);
      setCurrentUser(loggedIn);
      return loggedIn;
    } finally {
      setLoading(false);
    }
  };

  const loginDemo = (): AdminUser => {
    const demo = authService.signInDemo();
    setCurrentUser(demo);
    return demo;
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await authService.signOut();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const isAuthenticated = !!currentUser && currentUser.isAuthorized;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        user: currentUser, // Alias for backward compatibility
        loading,
        isAuthenticated,
        isFirebaseReady,
        login,
        loginDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
