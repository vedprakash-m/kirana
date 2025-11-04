import { Outlet, NavLink } from 'react-router-dom';
import { Home, Package, Upload, Settings, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * MainLayout - Application layout with responsive navigation
 * 
 * Desktop (≥1024px): Left sidebar (240px, collapsible)
 * Mobile (<1024px): Bottom tab bar (60px)
 * 
 * Features:
 * - Active route highlighting
 * - Collapsible sidebar on desktop
 * - Bottom navigation on mobile
 * - Responsive breakpoint at 1024px (UX Spec Section 2)
 */
export function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/import', icon: Upload, label: 'Import' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 hidden lg:flex flex-col bg-white border-r border-neutral-200 transition-all duration-300',
          isSidebarOpen ? 'w-60' : 'w-16'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-200">
          {isSidebarOpen && (
            <h1 className="text-xl font-semibold text-brand-blue">Kirana</h1>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="ml-auto"
          >
            {isSidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  'hover:bg-neutral-100',
                  isActive
                    ? 'bg-brand-blue text-white hover:bg-brand-blue-dark'
                    : 'text-neutral-700'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {isSidebarOpen && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        {isSidebarOpen && (
          <div className="p-4 border-t border-neutral-200">
            <div className="text-xs text-neutral-500">
              <p>Phase 1B MVP</p>
              <p className="mt-1">Version 0.1.0</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'min-h-screen transition-all duration-300',
          'lg:ml-60 pb-16 lg:pb-0',
          !isSidebarOpen && 'lg:ml-16'
        )}
      >
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-white border-t border-neutral-200 h-16">
        <div className="flex items-center justify-around h-full px-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
                  isActive
                    ? 'text-brand-blue'
                    : 'text-neutral-600 hover:text-neutral-900'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
