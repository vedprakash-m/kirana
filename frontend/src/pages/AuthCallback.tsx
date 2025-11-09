import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

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
 * 2. Redirected to /auth/callback with auth code
 * 3. MSAL processes redirect (handled in authService initializeMSAL)
 * 4. This component redirects to returnUrl or /dashboard
 */
export const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const processCallback = async () => {
      try {
        // MSAL handles the redirect in initializeMSAL() which runs on app startup
        // By the time we reach this component, auth should be processed
        // Get intended destination from state or default to dashboard
        const returnUrl = location.state?.returnUrl || '/dashboard';
        
        // Small delay to ensure auth state is fully updated
        setTimeout(() => {
          navigate(returnUrl, { replace: true });
        }, 500);
      } catch (error) {
        console.error('[AuthCallback] Failed to process callback:', error);
        // On error, redirect to landing page
        navigate('/', { replace: true });
      }
    };

    processCallback();
  }, [location, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue mx-auto mb-4" />
        <p className="text-gray-600 text-lg font-medium">Signing you in...</p>
        <p className="text-gray-500 text-sm mt-2">Please wait while we complete your authentication</p>
      </div>
    </div>
  );
};
