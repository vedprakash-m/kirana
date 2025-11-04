import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Category, UnitOfMeasure, PredictionConfidence, Vendor, type Item } from '@/types/shared';

// Helper function to get date X days ago
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// Helper function to get date X days from now
function getDateDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// Generate synthetic demo items
function generateDemoItems(): Item[] {
  const demoData = [
    { name: 'Organic Valley Whole Milk', brand: 'Organic Valley', category: Category.DAIRY, unit: UnitOfMeasure.GALLONS, freq: 7, lastDays: 3, price: 6.99, vendor: Vendor.WHOLE_FOODS },
    { name: 'Happy Egg Co. Free Range Eggs', brand: 'Happy Egg Co.', category: Category.DAIRY, unit: UnitOfMeasure.DOZEN, freq: 14, lastDays: 10, price: 5.49, vendor: Vendor.SAFEWAY },
    { name: "Dave's Killer Bread 21 Grain", brand: "Dave's Killer Bread", category: Category.BAKERY, unit: UnitOfMeasure.EACH, freq: 7, lastDays: 2, price: 5.99, vendor: Vendor.WHOLE_FOODS },
    { name: 'Organic Bananas', brand: undefined, category: Category.PRODUCE, unit: UnitOfMeasure.POUNDS, freq: 5, lastDays: 1, price: 0.79, vendor: Vendor.TRADER_JOES },
    { name: 'Starbucks Pike Place Roast', brand: 'Starbucks', category: Category.BEVERAGES, unit: UnitOfMeasure.OUNCES, freq: 30, lastDays: 15, price: 9.99, vendor: Vendor.AMAZON },
    { name: 'Organic Chicken Breast', brand: undefined, category: Category.MEAT_SEAFOOD, unit: UnitOfMeasure.POUNDS, freq: 10, lastDays: 5, price: 8.99, vendor: Vendor.WHOLE_FOODS },
    { name: 'Chobani Greek Yogurt Variety Pack', brand: 'Chobani', category: Category.DAIRY, unit: UnitOfMeasure.PACK, freq: 14, lastDays: 8, price: 10.99, vendor: Vendor.COSTCO },
    { name: 'Barilla Spaghetti', brand: 'Barilla', category: Category.PANTRY, unit: UnitOfMeasure.POUNDS, freq: 30, lastDays: 20, price: 1.99, vendor: Vendor.SAFEWAY },
    { name: "Rao's Marinara Sauce", brand: "Rao's", category: Category.PANTRY, unit: UnitOfMeasure.OUNCES, freq: 45, lastDays: 25, price: 8.99, vendor: Vendor.AMAZON },
    { name: 'Cheerios Original', brand: 'Cheerios', category: Category.PANTRY, unit: UnitOfMeasure.OUNCES, freq: 21, lastDays: 12, price: 4.99, vendor: Vendor.TARGET },
  ];

  return demoData.map((item, index) => {
    const runOutDays = item.freq - item.lastDays;
    const confidence = item.lastDays < 5 && item.freq <= 14 
      ? PredictionConfidence.HIGH 
      : item.freq <= 21 
        ? PredictionConfidence.MEDIUM 
        : PredictionConfidence.LOW;

    return {
      id: `demo-item-${index + 1}`,
      householdId: 'demo-household',
      canonicalName: item.name,
      brand: item.brand,
      category: item.category,
      quantity: 1,
      unitOfMeasure: item.unit,
      packageSize: 1,
      packageUnit: item.unit,
      lastPurchaseDate: getDateDaysAgo(item.lastDays),
      lastPurchasePrice: item.price,
      priceHistory: [],
      predictedRunOutDate: getDateDaysFromNow(runOutDays),
      predictionConfidence: confidence,
      avgFrequencyDays: item.freq,
      userOverrides: [],
      teachModeEnabled: false,
      preferredVendor: item.vendor,
      createdAt: getDateDaysAgo(60 + index * 20),
      updatedAt: getDateDaysAgo(item.lastDays),
      createdBy: 'demo-user',
      _etag: `demo-etag-${index + 1}`,
    };
  });
}

export function DemoMode() {
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [demoItems] = useState<Item[]>(() => generateDemoItems());

  useEffect(() => {
    // Initialize demo mode
    localStorage.setItem('demoMode', 'true');
    localStorage.setItem('demoItems', JSON.stringify(demoItems));
    localStorage.setItem('demoModeStartedAt', new Date().toISOString());
    setIsInitializing(false);
  }, [demoItems]);

  const handleSwitchToReal = () => {
    // Clear demo mode
    localStorage.removeItem('demoMode');
    localStorage.removeItem('demoItems');
    localStorage.removeItem('demoModeStartedAt');

    // Navigate to onboarding
    navigate('/import');
  };

  const handleViewInventory = () => {
    navigate('/inventory');
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('demoBannerDismissed', 'true');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-gray-600">Setting up demo data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container max-w-4xl mx-auto px-4">
        {/* Demo Mode Banner */}
        {showBanner && (
          <Card className="mb-6 p-4 bg-purple-50 border-purple-200">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-purple-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900 mb-1">
                  🎨 Demo Mode - This is sample data
                </h3>
                <p className="text-sm text-purple-800">
                  You're viewing a preview with 10 example items. None of this data will
                  be saved to your account. Switch to real data when you're ready!
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissBanner}
                className="shrink-0 text-purple-600 hover:bg-purple-100"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Welcome Card */}
        <Card className="p-8 mb-6">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-2">
              <Sparkles className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome to Kirana Demo! 🎉
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              You're exploring Kirana with sample data. See how smart predictions help you
              never run out of groceries.
            </p>
          </div>
        </Card>

        {/* Demo Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="font-semibold text-lg text-gray-900">
                Smart Predictions
              </h3>
              <p className="text-sm text-gray-600">
                See how Kirana predicts when you'll run out of items based on your
                purchase history. The demo includes 10 items with realistic predictions.
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="font-semibold text-lg text-gray-900">
                Dynamic Urgency
              </h3>
              <p className="text-sm text-gray-600">
                Items are color-coded by urgency. Red means running out soon, yellow is
                getting low, green means you have time.
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🔄</span>
              </div>
              <h3 className="font-semibold text-lg text-gray-900">
                One-Tap Restock
              </h3>
              <p className="text-sm text-gray-600">
                Try the "One-Tap Restock" feature to mark items as purchased. The demo
                will update predictions instantly!
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">💡</span>
              </div>
              <h3 className="font-semibold text-lg text-gray-900">
                Confidence Scores
              </h3>
              <p className="text-sm text-gray-600">
                Each prediction has a confidence level (High/Medium/Low) based on how
                consistent your purchase pattern is.
              </p>
            </div>
          </Card>
        </div>

        {/* What's Included Section */}
        <Card className="p-6 mb-8">
          <h3 className="font-semibold text-lg text-gray-900 mb-4">
            📦 What's in the demo inventory:
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {demoItems.map((item, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <span className="text-xl">
                  {item.category === Category.DAIRY
                    ? '🥛'
                    : item.category === Category.BAKERY
                    ? '🍞'
                    : item.category === Category.PRODUCE
                    ? '🍌'
                    : item.category === Category.BEVERAGES
                    ? '☕'
                    : item.category === Category.MEAT_SEAFOOD
                    ? '🍗'
                    : '🥫'}
                </span>
                <div>
                  <p className="font-medium text-gray-900">{item.canonicalName}</p>
                  <p className="text-gray-500 text-xs">
                    {item.predictionConfidence === PredictionConfidence.HIGH
                      ? 'High confidence'
                      : item.predictionConfidence === PredictionConfidence.MEDIUM
                      ? 'Medium confidence'
                      : 'Low confidence'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            size="lg"
            onClick={handleViewInventory}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Explore Demo Inventory
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={handleSwitchToReal}
            className="flex-1 border-2"
          >
            <ArrowRight className="w-5 h-5 mr-2" />
            Switch to Real Data
          </Button>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            💡 <strong>Remember:</strong> Demo data resets when you leave and doesn't sync
            to any server. Your real data will be private and secure.
          </p>
        </div>
      </div>
    </div>
  );
}
