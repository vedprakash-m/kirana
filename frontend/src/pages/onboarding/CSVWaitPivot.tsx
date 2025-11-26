import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TeachModeQuickEntry } from '@/components/onboarding/TeachModeQuickEntry';
import { itemsApi } from '@/services/itemsApi';
import { useAuthStore } from '@/store/authStore';

type ViewState = 'instructions' | 'teach-mode';

export function CSVWaitPivot() {
  const navigate = useNavigate();
  const [viewState, setViewState] = useState<ViewState>('instructions');
  const { user } = useAuthStore();

  // Handle opening Amazon in new tab
  const handleOpenAmazon = () => {
    window.open('https://www.amazon.com/gp/b2b/reports', '_blank');
  };

  // Handle continuing to teach mode
  const handleContinue = () => {
    setViewState('teach-mode');
  };

  // Handle teach mode completion
  const handleTeachModeComplete = async (
    items: Array<{
      name: string;
      emoji: string;
      category: string;
      frequency: number;
      frequencyLabel: string;
      lastPurchaseDate: string;
      predictedRunOutDate: string;
    }>
  ) => {
    try {
      // Get user ID from auth store
      const userId = user?.id;
      const householdId = user?.householdId;

      if (!userId || !householdId) {
        throw new Error('User not authenticated or missing household');
      }

      // Create each item via teach mode API
      for (const item of items) {
        await itemsApi.createTeachModeItem({
          userId,
          householdId,
          itemName: item.name,
          category: item.category,
          frequency: item.frequencyLabel as 'daily' | 'weekly' | 'biweekly' | 'monthly',
          lastPurchaseDate: item.lastPurchaseDate,
        });
      }

      // Set localStorage flags
      localStorage.setItem('awaitingCSV', 'true');
      localStorage.setItem('teachModeItemsAdded', items.length.toString());
      localStorage.setItem('teachModeCompletedAt', new Date().toISOString());

      // Navigate to home with success message
      navigate('/dashboard', {
        state: {
          message: `🎉 ${items.length} ${items.length === 1 ? 'prediction' : 'predictions'} ready! Upload your CSV when it arrives.`,
        },
      });
    } catch (error) {
      console.error('Error creating teach mode items:', error);
      alert('Failed to create items. Please try again.');
    }
  };

  // Handle skip
  const handleSkip = () => {
    localStorage.setItem('awaitingCSV', 'true');
    localStorage.setItem('teachModeSkipped', 'true');
    navigate('/dashboard');
  };

  // Handle back navigation
  const handleBack = () => {
    if (viewState === 'teach-mode') {
      setViewState('instructions');
    } else {
      navigate('/import');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            Import from Amazon
          </h1>
        </div>

        {/* Instructions View */}
        {viewState === 'instructions' && (
          <div className="space-y-6">
            {/* Wait time callout */}
            <Card className="p-6 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <Clock className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-blue-900">
                    📧 Amazon sends order reports via email
                  </h2>
                  <p className="text-blue-800">
                    This takes <strong>5-10 minutes</strong>. Let's get you started now!
                  </p>
                </div>
              </div>
            </Card>

            {/* Step 1: Request Report */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Step 1: Request your report from Amazon
              </h3>
              <div className="space-y-3 mb-6">
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Click button below to open Amazon</li>
                  <li>Go to <strong>Account → Download Order Reports</strong></li>
                  <li>Select: <strong>Last 12 months, CSV format</strong></li>
                  <li>Click <strong>"Request Report"</strong></li>
                  <li>Check your email in <strong>5-10 minutes</strong></li>
                </ol>
              </div>
              <Button
                size="lg"
                onClick={handleOpenAmazon}
                className="w-full"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Open Amazon in New Tab
              </Button>
            </Card>

            {/* Step 2: Teach Mode Pivot */}
            <Card className="p-6 bg-linear-to-br from-purple-50 to-blue-50 border-purple-200">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  <h3 className="text-xl font-semibold text-gray-900">
                    While you wait, let's get your first predictions!
                  </h3>
                </div>
                <p className="text-gray-700">
                  Add 3-5 items you buy often. We'll give you instant predictions,
                  then merge them with your Amazon data when it arrives.
                </p>
                <Button
                  size="lg"
                  onClick={handleContinue}
                  className="w-full bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  Continue → Get Predictions Now
                </Button>
              </div>
            </Card>

            {/* Skip option */}
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-gray-600"
              >
                Skip for now - I'll wait for the email
              </Button>
            </div>

            {/* Helper text */}
            <Card className="p-4 bg-gray-50">
              <p className="text-sm text-gray-600">
                💡 <strong>Why add items manually?</strong> It only takes 2 minutes
                and gives you immediate value. Plus, we'll merge these with your
                Amazon history automatically - no duplicates!
              </p>
            </Card>
          </div>
        )}

        {/* Teach Mode View */}
        {viewState === 'teach-mode' && (
          <Card className="p-6">
            <div className="mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                <p className="text-sm text-blue-800">
                  ⏱️ <strong>Your Amazon report is still generating...</strong>
                  <br />
                  We'll merge these items with your Amazon data when it arrives.
                </p>
              </div>
            </div>

            <TeachModeQuickEntry
              onComplete={handleTeachModeComplete}
              onSkip={handleSkip}
              minItems={1}
              maxItems={8}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
