import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Placeholder pages (will be created in subsequent tasks)
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/InventoryPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { ImportPage } from './pages/ImportPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected routes with layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/items/:id" element={<ItemDetailPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
