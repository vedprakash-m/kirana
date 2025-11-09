import { PublicClientApplication } from '@azure/msal-browser';
import type { Configuration, AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/store/authStore';

/**
 * MSAL Auth Service - Handles Azure AD B2C authentication
 * 
 * Implements authentication flow using Microsoft Authentication Library (MSAL).
 * Supports sign-in, sign-out, token refresh, and silent authentication.
 * 
 * Security Improvements (v1.1):
 * - Refresh tokens stored in HttpOnly cookies (backend-managed)
 * - Access tokens in sessionStorage via authStore
 * - Automatic token refresh via backend /api/auth/refresh endpoint
 * - Token rotation on every refresh for improved security
 * 
 * References:
 * - PRD Section 9.1: Microsoft Entra ID (Azure AD B2C)
 * - Tech Spec Section 8.1: Authentication & Authorization
 * - Tech Spec Section 8.5: Session Management & Device Tracking
 * - Security Audit (Nov 2025): Frontend token storage vulnerability fix
 */

// MSAL Configuration for Microsoft Entra ID
const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || '',
    authority: `${import.meta.env.VITE_ENTRA_AUTHORITY || 'https://login.microsoftonline.com/'}${import.meta.env.VITE_ENTRA_TENANT_ID || 'common'}`,
    redirectUri: import.meta.env.VITE_ENTRA_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage', // Use sessionStorage for better security
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        
        switch (level) {
          case 0: // Error
            console.error('[MSAL Error]', message);
            break;
          case 1: // Warning
            console.warn('[MSAL Warning]', message);
            break;
          case 2: // Info
            console.info('[MSAL Info]', message);
            break;
          case 3: // Verbose
            console.debug('[MSAL Verbose]', message);
            break;
        }
      },
    },
  },
};

// Initialize MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Track initialization state
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Login request scopes
const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};

/**
 * Initialize MSAL on app startup
 * Handles redirect promise and restores auth state
 * 
 * MUST be called before any other MSAL operations
 */
export async function initializeMSAL(): Promise<void> {
  // Return existing promise if initialization is already in progress
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // Return immediately if already initialized
  if (isInitialized) {
    return Promise.resolve();
  }
  
  initializationPromise = (async () => {
    try {
      console.log('[MSAL] Initializing...');
      await msalInstance.initialize();
      isInitialized = true;
      console.log('[MSAL] Initialized successfully');
      
      // Handle redirect promise (after redirect from Entra ID)
      const response = await msalInstance.handleRedirectPromise();
      
      if (response) {
        // User just logged in via redirect
        console.log('[MSAL] User authenticated via redirect');
        handleAuthResponse(response);
      } else {
        // Try to get account from cache (silent auth)
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          msalInstance.setActiveAccount(accounts[0]);
          console.log('[MSAL] Active account restored from cache');
          
          // Try to acquire token silently
          try {
            const tokenResponse = await msalInstance.acquireTokenSilent({
              ...loginRequest,
              account: accounts[0],
            });
            handleAuthResponse(tokenResponse);
          } catch (error) {
            // Silent token acquisition failed, user needs to sign in again
            console.warn('[MSAL] Silent token acquisition failed:', error);
            useAuthStore.getState().signOut();
          }
        }
      }
    } catch (error) {
      console.error('[MSAL] Initialization error:', error);
      useAuthStore.getState().setError('Authentication initialization failed');
    }
  })();
  
  return initializationPromise;
}

/**
 * Sign in using popup
 */
export async function signInWithPopup(): Promise<void> {
  try {
    // Ensure MSAL is initialized
    await initializeMSAL();
    
    useAuthStore.getState().setLoading(true);
    useAuthStore.getState().clearError();
    
    const response = await msalInstance.loginPopup(loginRequest);
    handleAuthResponse(response);
  } catch (error: unknown) {
    console.error('[MSAL] Sign in error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
    useAuthStore.getState().setError(errorMessage);
    useAuthStore.getState().setLoading(false);
  }
}

/**
 * Sign in using redirect
 * User will be redirected to Microsoft Entra ID and back
 */
export async function signInWithRedirect(): Promise<void> {
  try {
    // Ensure MSAL is initialized
    await initializeMSAL();
    
    useAuthStore.getState().setLoading(true);
    useAuthStore.getState().clearError();
    
    console.log('[MSAL] Initiating redirect login...');
    await msalInstance.loginRedirect(loginRequest);
  } catch (error: unknown) {
    console.error('[MSAL] Sign in error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
    useAuthStore.getState().setError(errorMessage);
    useAuthStore.getState().setLoading(false);
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  try {
    const account = msalInstance.getActiveAccount();
    if (account) {
      await msalInstance.logoutPopup({
        account,
        postLogoutRedirectUri: window.location.origin,
      });
    }
    
    useAuthStore.getState().signOut();
  } catch (error: unknown) {
    console.error('Sign out error:', error);
    // Force sign out locally even if server sign out fails
    useAuthStore.getState().signOut();
  }
}

/**
 * Get access token (silently)
 * Automatically refreshes token if expired using backend refresh endpoint
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { accessToken, isTokenExpired } = useAuthStore.getState();
    
    // Return cached token if still valid
    if (accessToken && !isTokenExpired()) {
      return accessToken;
    }

    // Token expired - refresh via backend endpoint
    console.log('🔄 Access token expired, refreshing...');
    
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Important: sends HttpOnly cookie
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Refresh failed - user needs to sign in again
      console.warn('Token refresh failed:', response.status);
      useAuthStore.getState().signOut();
      return null;
    }

    const data = await response.json();
    
    if (!data.success || !data.data.accessToken) {
      console.warn('Invalid refresh response');
      useAuthStore.getState().signOut();
      return null;
    }

    // Update store with new access token
    // Note: New refresh token is automatically set in HttpOnly cookie by backend
    useAuthStore.getState().refreshAccessToken(
      data.data.accessToken,
      data.data.expiresIn || 3600
    );

    console.log('✅ Access token refreshed successfully');
    return data.data.accessToken;
  } catch (error) {
    console.error('Token refresh error:', error);
    useAuthStore.getState().signOut();
    return null;
  }
}

/**
 * Handle authentication response
 * Extracts user info and updates store
 */
function handleAuthResponse(response: AuthenticationResult): void {
  if (!response || !response.account) {
    console.warn('No account in auth response');
    return;
  }

  const account = response.account;
  msalInstance.setActiveAccount(account);

  // Extract user info from ID token claims
  const user: User = {
    id: account.localAccountId, // Azure AD B2C user ID
    email: account.username, // Email
    displayName: account.name || account.username,
    createdAt: new Date().toISOString(),
  };

  // Calculate token expiry (default 1 hour if not provided)
  const expiresIn = response.expiresOn 
    ? Math.floor((response.expiresOn.getTime() - Date.now()) / 1000)
    : 3600; // 1 hour

  // Update auth store (no refresh token - handled server-side)
  useAuthStore.getState().signIn(
    user,
    response.accessToken,
    expiresIn
  );
}

/**
 * Get current user account
 */
export function getCurrentAccount(): AccountInfo | null {
  return msalInstance.getActiveAccount();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const account = msalInstance.getActiveAccount();
  const { isAuthenticated } = useAuthStore.getState();
  return !!account && isAuthenticated;
}
