import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRouteWrapper } from './components/auth/ProtectedRouteWrapper';
import { ToastProvider } from './components/ui/toast';

// Public pages
import { LandingPage } from './pages/LandingPage';
import { AuthCallback } from './pages/AuthCallback';

// Protected pages
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/InventoryPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';

// Onboarding pages
import { CSVWaitPivot } from './pages/onboarding/CSVWaitPivot';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          {/* Protected routes with layout */}
          <Route element={<ProtectedRouteWrapper />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<HomePage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/items/:id" element={<ItemDetailPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            
            {/* Onboarding routes (no main layout) */}
            <Route path="/onboarding/csv-wait" element={<CSVWaitPivot />} />
          </Route>
          
          {/* Legacy route redirects */}
          <Route path="/home" element={<Navigate to="/dashboard" replace />} />
          
          {/* Catch-all: redirect to landing for unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
