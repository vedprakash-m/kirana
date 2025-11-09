import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Loader2 } from 'lucide-react';

/**
 * ProtectedRouteWrapper Component
 * 
 * Wraps protected routes and redirects unauthenticated users to landing page.
 * Shows loading spinner while checking authentication status.
 * Preserves intended destination for post-login redirect.
 * 
 * Usage in App.tsx:
 * ```tsx
 * <Route element={<ProtectedRouteWrapper />}>
 *   <Route path="/dashboard" element={<HomePage />} />
 *   <Route path="/inventory" element={<InventoryPage />} />
 * </Route>
 * ```
 */
export const ProtectedRouteWrapper = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-blue mx-auto mb-4" />
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to landing page if not authenticated
  // Save intended destination for post-login redirect
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/"
        state={{ returnUrl: location.pathname }}
        replace
      />
    );
  }

  // Render protected route
  return <Outlet />;
};
