import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Home, 
  Bell, 
  Shield, 
  Download, 
  FileText, 
  Trash2, 
  LogOut,
  ChevronRight,
  Monitor,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuthStore } from '@/store/authStore';

/**
 * SettingsPage - User preferences and household management
 * 
 * Per UX Spec Section 3.7:
 * - Profile section
 * - Household management
 * - Notification preferences
 * - Session management
 * - Data & Privacy (GDPR compliance)
 * - Danger zone (delete account)
 */
export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // TODO: Call export API
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Your data export has been initiated. You will receive an email with the download link.');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // TODO: Call delete account API
      await new Promise(resolve => setTimeout(resolve, 2000));
      signOut();
      navigate('/');
    } catch (error) {
      console.error('Delete account failed:', error);
      alert('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900">Delete Account?</h3>
              </div>
              <p className="text-neutral-600 mb-4">
                This action is <strong>permanent</strong> and cannot be undone. All your data, 
                including inventory items, purchase history, and predictions will be deleted.
              </p>
              <p className="text-sm text-neutral-500 mb-6">
                If you're part of a household, your items will be transferred to the household admin.
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Yes, Delete My Account'
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
      </div>

      {/* Profile Section */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-neutral-900">
                {user?.displayName || 'User'}
              </h2>
              <p className="text-neutral-600">{user?.email || 'No email'}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => alert('Profile editing coming soon!')}>
              Edit <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Household Section */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <SettingsRow
            icon={<Home className="h-5 w-5" />}
            title="Household"
            description={user?.householdId ? "Manage your household members" : "Create or join a household"}
            onClick={() => alert('Household management coming soon!')}
          />
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card className="mb-6">
        <CardContent className="py-6 space-y-4">
          <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </h3>
          
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-neutral-900">Email Notifications</p>
              <p className="text-sm text-neutral-500">Get notified about running-out items</p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>
          
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-neutral-900">Weekly Digest</p>
              <p className="text-sm text-neutral-500">Receive a weekly summary email</p>
            </div>
            <Switch checked={weeklyDigest} onCheckedChange={setWeeklyDigest} />
          </div>
          
          <div className="flex items-center justify-between py-2 opacity-50">
            <div>
              <p className="font-medium text-neutral-900">Push Notifications</p>
              <p className="text-sm text-neutral-500">Coming in Phase 2</p>
            </div>
            <Switch disabled checked={false} />
          </div>
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <SettingsRow
            icon={<Monitor className="h-5 w-5" />}
            title="Active Sessions"
            description="View and manage your active devices"
            onClick={() => alert('Session management coming soon!')}
          />
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card className="mb-6">
        <CardContent className="py-6 space-y-4">
          <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data & Privacy
          </h3>
          
          <button 
            className="flex items-center gap-3 w-full py-2 hover:bg-neutral-50 rounded-lg transition-colors text-left"
            onClick={handleExportData}
            disabled={isExporting}
          >
            <Download className="h-5 w-5 text-neutral-600" />
            <div className="flex-1">
              <p className="font-medium text-neutral-900">Export My Data</p>
              <p className="text-sm text-neutral-500">Download all your data as JSON</p>
            </div>
            {isExporting && <Loader2 className="h-4 w-4 animate-spin" />}
          </button>
          
          <button 
            className="flex items-center gap-3 w-full py-2 hover:bg-neutral-50 rounded-lg transition-colors text-left"
            onClick={() => alert('Audit logs coming soon!')}
          >
            <FileText className="h-5 w-5 text-neutral-600" />
            <div className="flex-1">
              <p className="font-medium text-neutral-900">View Audit Logs</p>
              <p className="text-sm text-neutral-500">See your account activity (90 days)</p>
            </div>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
          
          <a 
            href="/privacy" 
            target="_blank"
            className="flex items-center gap-3 py-2 hover:bg-neutral-50 rounded-lg transition-colors"
          >
            <FileText className="h-5 w-5 text-neutral-600" />
            <p className="font-medium text-neutral-900">Privacy Policy</p>
          </a>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="mb-6 border-red-200">
        <CardContent className="py-6">
          <h3 className="font-semibold text-red-600 mb-4">Danger Zone</h3>
          <button 
            className="flex items-center gap-3 w-full py-2 hover:bg-red-50 rounded-lg transition-colors text-left"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-5 w-5 text-red-600" />
            <div className="flex-1">
              <p className="font-medium text-red-600">Delete Account</p>
              <p className="text-sm text-neutral-500">Permanently delete your account and all data</p>
            </div>
          </button>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Button 
        variant="outline" 
        className="w-full" 
        size="lg"
        onClick={handleSignOut}
      >
        <LogOut className="h-5 w-5 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}

/**
 * SettingsRow - Reusable settings row component
 */
function SettingsRow({ 
  icon, 
  title, 
  description, 
  onClick 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  onClick?: () => void;
}) {
  return (
    <button 
      className="flex items-center gap-4 w-full py-2 hover:bg-neutral-50 rounded-lg transition-colors text-left"
      onClick={onClick}
    >
      <div className="p-2 bg-neutral-100 rounded-lg">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium text-neutral-900">{title}</p>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-neutral-400" />
    </button>
  );
}
