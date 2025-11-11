import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { msalInstance } from '../services/authService';
import { useAuthStore } from '../store/authStore';

/**
 * AuthCallback Component
 * 
 * Handles OAuth redirect callback from Microsoft Entra ID.
 * Processes authentication response and redirects to intended destination.
 * 
 * Route: /auth/callback (public, but redirects after processing)
 * 
 * Flow:
 * 1. User completes Microsoft Entra ID login
 * 2. Redirected to /auth/callback with auth code in URL hash
 * 3. MSAL processes redirect and exchanges code for tokens
 * 4. User state is updated and redirected to dashboard
 */
export const AuthCallback = () => {
  const navigate = useNavigate();
  const { signIn } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        console.log('[AuthCallback] Processing redirect...');
        
        // Handle the redirect promise from MSAL
        const response = await msalInstance.handleRedirectPromise();
        
        if (response) {
          console.log('[AuthCallback] Redirect response received:', {
            account: response.account?.username,
            hasToken: !!response.accessToken,
          });

          // Update auth store with the authenticated user
          if (response.account && response.accessToken) {
            const expiresIn = response.expiresOn 
              ? Math.floor((response.expiresOn.getTime() - Date.now()) / 1000)
              : 3600;

            signIn(
              {
                id: response.account.localAccountId,
                email: response.account.username,
                displayName: response.account.name || response.account.username,
                createdAt: new Date().toISOString(),
              },
              response.accessToken,
              expiresIn
            );
          }

          console.log('[AuthCallback] Redirecting to dashboard...');
          navigate('/dashboard', { replace: true });
        } else {
          console.log('[AuthCallback] No response from redirect, checking if already authenticated');
          
          // Check if user is already authenticated
          const accounts = msalInstance.getAllAccounts();
          if (accounts.length > 0) {
            console.log('[AuthCallback] User already authenticated, redirecting to dashboard');
            navigate('/dashboard', { replace: true });
          } else {
            console.log('[AuthCallback] No authentication found, redirecting to home');
            navigate('/', { replace: true });
          }
        }
      } catch (error) {
        console.error('[AuthCallback] Failed to process callback:', error);
        setError(error instanceof Error ? error.message : 'Authentication failed');
        
        // Redirect to home after showing error
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
      }
    };

    processCallback();
  }, [navigate, signIn]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-b from-slate-50 to-white">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Authentication Failed</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <p className="text-sm text-slate-500">Redirecting to home page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-linear-to-b from-slate-50 to-white">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-slate-900 text-xl font-semibold">Signing you in...</p>
        <p className="text-slate-600 text-sm mt-2">Please wait while we complete your authentication</p>
      </div>
    </div>
  );
};
