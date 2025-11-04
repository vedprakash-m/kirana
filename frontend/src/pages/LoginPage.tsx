import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * LoginPage - Authentication page
 * 
 * Phase 1B Placeholder: Will integrate with MSAL in Task 1B.1
 * For now, provides a simple mock login to access the app.
 */
export function LoginPage() {
  const navigate = useNavigate();

  const handleMockLogin = () => {
    // TODO: Integrate with MSAL (Task 1B.1)
    // For now, just navigate to home page
    navigate('/');
  };

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
          <Button
            onClick={handleMockLogin}
            className="w-full"
            size="lg"
          >
            Sign in with Microsoft (Mock)
          </Button>

          <p className="text-xs text-center text-neutral-500">
            Phase 1B Placeholder - MSAL integration coming in Task 1B.1
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-200">
          <p className="text-sm text-neutral-600 text-center">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
