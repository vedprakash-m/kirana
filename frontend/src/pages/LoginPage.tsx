import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { signInWithRedirect } from '@/services/authService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

/**
 * LoginPage - Microsoft Entra ID Authentication
 * 
 * Implements OAuth 2.0 authentication flow using MSAL (Microsoft Authentication Library).
 * Users sign in with their Microsoft account, which redirects to Azure AD for authentication.
 * 
 * Flow:
 * 1. User clicks "Sign in with Microsoft"
 * 2. Redirects to Microsoft Entra ID login page
 * 3. After successful authentication, redirects back to app
 * 4. MSAL handles token acquisition and storage
 * 5. User is redirected to home page
 * 
 * References:
 * - PRD Section 9.1: Microsoft Entra ID Integration
 * - Tech Spec Section 8.1: Authentication & Authorization
 */
export function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if Entra ID is configured
      const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
      const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;
      
      if (!clientId || !tenantId) {
        // Entra ID not configured - use mock mode
        console.warn('⚠️ Azure Entra ID not configured. Using mock authentication.');
        setError('Azure Entra ID is not configured. Please set VITE_ENTRA_CLIENT_ID and VITE_ENTRA_TENANT_ID in .env.local');
        
        // Allow bypass in development mode
        if (import.meta.env.DEV) {
          console.log('🔓 Development mode: Bypassing authentication');
          navigate('/');
        }
        return;
      }
      
      // Real MSAL authentication
      await signInWithRedirect();
      
      // Note: After redirect, user will come back to /auth/callback
      // which is handled by MSAL automatically
    } catch (err) {
      console.error('Login error:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'An error occurred during sign-in. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Check if running in mock mode
  const isMockMode = !import.meta.env.VITE_ENTRA_CLIENT_ID || !import.meta.env.VITE_ENTRA_TENANT_ID;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-brand-blue mb-2">Kirana</h1>
          <p className="text-neutral-600">
            Smart Household Inventory Manager
          </p>
        </div>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {isMockMode && import.meta.env.DEV && (
            <Alert>
              <AlertDescription>
                <strong>Development Mode:</strong> Azure Entra ID not configured. 
                Click below to bypass authentication.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSignIn}
            className="w-full"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in with Microsoft'
            )}
          </Button>

          {isMockMode && (
            <p className="text-xs text-center text-amber-600 bg-amber-50 p-2 rounded">
              ⚠️ Azure Entra ID not configured. See README for setup instructions.
            </p>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-200">
          <p className="text-sm text-neutral-600 text-center">
            By signing in, you agree to our{' '}
            <a href="/terms" className="text-brand-blue hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-brand-blue hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
