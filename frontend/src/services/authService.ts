import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import type { Configuration, AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/store/authStore';

/**
 * MSAL Auth Service - Handles Azure AD B2C authentication
 * 
 * Implements authentication flow using Microsoft Authentication Library (MSAL).
 * Supports sign-in, sign-out, token refresh, and silent authentication.
 * 
 * References:
 * - PRD Section 9.1: Microsoft Entra ID (Azure AD B2C)
 * - Tech Spec Section 3.3: Azure AD B2C + MSAL
 * - MSAL Docs: https://learn.microsoft.com/azure/active-directory/develop/msal-js-initializing-client-applications
 */

// MSAL Configuration
const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID || '',
    authority: `https://${import.meta.env.VITE_AZURE_AD_TENANT_NAME}.b2clogin.com/${import.meta.env.VITE_AZURE_AD_TENANT_NAME}.onmicrosoft.com/${import.meta.env.VITE_AZURE_AD_POLICY_NAME}`,
    knownAuthorities: [`${import.meta.env.VITE_AZURE_AD_TENANT_NAME}.b2clogin.com`],
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage', // Store tokens in localStorage
    storeAuthStateInCookie: false, // Set to true if you're supporting IE11
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        
        switch (level) {
          case 0: // Error
            console.error(message);
            break;
          case 1: // Warning
            console.warn(message);
            break;
          case 2: // Info
            console.info(message);
            break;
          case 3: // Verbose
            console.debug(message);
            break;
        }
      },
    },
  },
};

// Initialize MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Login request scopes
const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};

/**
 * Initialize MSAL on app startup
 * Handles redirect promise and restores auth state
 */
export async function initializeMSAL(): Promise<void> {
  try {
    await msalInstance.initialize();
    
    // Handle redirect promise (after redirect from Azure AD B2C)
    const response = await msalInstance.handleRedirectPromise();
    
    if (response) {
      // User just logged in via redirect
      handleAuthResponse(response);
    } else {
      // Try to get account from cache (silent auth)
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
        
        // Try to acquire token silently
        try {
          const tokenResponse = await msalInstance.acquireTokenSilent({
            ...loginRequest,
            account: accounts[0],
          });
          handleAuthResponse(tokenResponse);
        } catch (error) {
          // Silent token acquisition failed, user needs to sign in again
          console.warn('Silent token acquisition failed:', error);
          useAuthStore.getState().signOut();
        }
      }
    }
  } catch (error) {
    console.error('MSAL initialization error:', error);
    useAuthStore.getState().setError('Authentication initialization failed');
  }
}

/**
 * Sign in using popup
 */
export async function signInWithPopup(): Promise<void> {
  try {
    useAuthStore.getState().setLoading(true);
    useAuthStore.getState().clearError();
    
    const response = await msalInstance.loginPopup(loginRequest);
    handleAuthResponse(response);
  } catch (error: unknown) {
    console.error('Sign in error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
    useAuthStore.getState().setError(errorMessage);
    useAuthStore.getState().setLoading(false);
  }
}

/**
 * Sign in using redirect
 * User will be redirected to Azure AD B2C and back
 */
export async function signInWithRedirect(): Promise<void> {
  try {
    useAuthStore.getState().setLoading(true);
    useAuthStore.getState().clearError();
    
    await msalInstance.loginRedirect(loginRequest);
  } catch (error: unknown) {
    console.error('Sign in error:', error);
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
 * Automatically refreshes token if expired
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const account = msalInstance.getActiveAccount();
    if (!account) {
      return null;
    }

    // Check if token is expired in Zustand store
    const { isTokenExpired } = useAuthStore.getState();
    if (!isTokenExpired()) {
      // Token is still valid in store
      const { accessToken } = useAuthStore.getState();
      return accessToken;
    }

    // Token is expired, acquire new one silently
    const response = await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account,
      forceRefresh: false, // Use cached token if available
    });

    // Update store with new token
    useAuthStore.getState().refreshAccessToken(
      response.accessToken,
      response.expiresOn ? Math.floor((response.expiresOn.getTime() - Date.now()) / 1000) : 3600
    );

    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      // Token refresh failed, user needs to sign in again
      console.warn('Token refresh requires interaction:', error);
      useAuthStore.getState().signOut();
      
      // Optionally trigger sign in flow
      // await signInWithPopup();
    } else {
      console.error('Token acquisition error:', error);
    }
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

  // Update auth store
  useAuthStore.getState().signIn(
    user,
    response.accessToken,
    response.idToken, // Use ID token as refresh token (Azure AD B2C doesn't return separate refresh token)
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
