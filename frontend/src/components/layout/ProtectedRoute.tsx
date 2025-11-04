import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * ProtectedRoute - Wrapper for routes that require authentication
 * 
 * Integrated with Auth Store (Task 1B.1) for MSAL authentication.
 * 
 * Flow:
 * 1. Check if user is authenticated (from Auth Store)
 * 2. If loading, show spinner
 * 3. If authenticated, render child routes (<Outlet />)
 * 4. If not authenticated, redirect to /login
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-neutral-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
