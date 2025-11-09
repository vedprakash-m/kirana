import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Auth Store - Manages authentication state using Zustand
 * 
 * Integrated with Microsoft Authentication Library (MSAL) for Azure AD B2C.
 * Stores user info, tokens, and authentication status.
 * 
 * Security Improvements (v1.1):
 * - Access tokens stored in sessionStorage (not localStorage) to reduce XSS risk
 * - Refresh tokens NEVER stored in frontend (HttpOnly cookies only)
 * - Automatic token refresh via backend /api/auth/refresh endpoint
 * - Token expiry buffer (5 minutes) for proactive refresh
 * 
 * Features:
 * - Persistent auth state (survives page refresh via sessionStorage)
 * - JWT token management (access tokens only)
 * - User profile caching
 * - Sign in/out actions
 * 
 * References:
 * - PRD Section 9.1: Microsoft Entra ID (Azure AD B2C)
 * - Tech Spec Section 8.1: Authentication & Authorization
 * - Security Audit (Nov 2025): XSS vulnerability mitigations
 */

export interface User {
  id: string; // User ID (from Azure AD B2C sub claim)
  email: string;
  displayName: string;
  householdId?: string; // Linked household (if any)
  createdAt: string;
}

export interface AuthState {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  accessToken: string | null;
  // SECURITY: refreshToken removed - handled server-side via HttpOnly cookies
  tokenExpiry: number | null; // Unix timestamp (ms)
  error: string | null;

  // Actions
  signIn: (user: User, accessToken: string, expiresIn: number) => void;
  signOut: () => void;
  setUser: (user: User) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  refreshAccessToken: (newAccessToken: string, expiresIn: number) => void;
  isTokenExpired: () => boolean;
  clearError: () => void;
}

/**
 * useAuthStore - Zustand store for authentication
 * 
 * Usage:
 * ```tsx
 * const { isAuthenticated, user, signIn, signOut } = useAuthStore();
 * 
 * // Sign in (refresh token handled server-side)
 * signIn(user, accessToken, 3600);
 * 
 * // Check auth
 * if (isAuthenticated && !isTokenExpired()) {
 *   // User is authenticated
 * }
 * 
 * // Sign out
 * signOut();
 * ```
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      isLoading: false,
      user: null,
      accessToken: null,
      tokenExpiry: null,
      error: null,

      // Actions
      signIn: (user, accessToken, expiresIn) => {
        const tokenExpiry = Date.now() + expiresIn * 1000; // Convert seconds to ms
        
        set({
          isAuthenticated: true,
          isLoading: false,
          user,
          accessToken,
          tokenExpiry,
          error: null,
        });

        console.log('✅ User signed in:', user.email);
      },

      signOut: () => {
        set({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          accessToken: null,
          tokenExpiry: null,
          error: null,
        });

        console.log('👋 User signed out');
      },

      setUser: (user) => {
        set({ user });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error, isLoading: false });
      },

      refreshAccessToken: (newAccessToken, expiresIn) => {
        const tokenExpiry = Date.now() + expiresIn * 1000;
        
        set({
          accessToken: newAccessToken,
          tokenExpiry,
          error: null,
        });

        console.log('🔄 Access token refreshed');
      },

      isTokenExpired: () => {
        const { tokenExpiry } = get();
        if (!tokenExpiry) return true;
        
        // Add 5-minute buffer (refresh 5 min before expiry)
        const bufferMs = 5 * 60 * 1000;
        return Date.now() >= tokenExpiry - bufferMs;
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'kirana-auth-storage', // sessionStorage key (changed from localStorage)
      storage: typeof window !== 'undefined' ? {
        getItem: (name) => {
          const value = sessionStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      } : undefined,
      // Only persist authentication fields (exclude isLoading, error, and action functions)
      // SECURITY: refreshToken removed - never stored in frontend
      // Note: We manually filter which fields to persist in getItem/setItem above
    }
  )
);

/**
 * Helper function to get current user ID
 * Returns null if not authenticated
 */
export function getCurrentUserId(): string | null {
  const { user, isAuthenticated } = useAuthStore.getState();
  return isAuthenticated && user ? user.id : null;
}

/**
 * Helper function to get current access token
 * Returns null if not authenticated or token is expired
 */
export function getCurrentAccessToken(): string | null {
  const { accessToken, isTokenExpired } = useAuthStore.getState();
  if (!accessToken || isTokenExpired()) {
    return null;
  }
  return accessToken;
}
