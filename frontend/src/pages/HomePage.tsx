import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Upload, RefreshCw, ArrowRight, Sparkles, TrendingUp, AlertTriangle, Package, DollarSign } from 'lucide-react';
import { useItemsStore } from '@/store/itemsStore';
import { useAuthStore } from '@/store/authStore';
import { transactionsApi } from '@/services/transactionsApi';
import { ItemCard } from '@/components/items/ItemCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateUrgency, UrgencyLevel } from '@/utils/urgencyCalculator';
import { cn } from '@/lib/utils';

/**
 * HomePage - Dashboard with running-out items and quick actions
 * 
 * Per UX Spec Section 3.1:
 * - Quick Stats Bar (4 metrics)
 * - Running Out Soon section (≤7 days)
 * - Confidence Coach (prediction health)
 * - Quick Actions (Add Item, Upload CSV)
 * - Recent Activity
 */
export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { items, isLoading, loadItems, syncItems } = useItemsStore();
  
  const [restockingItems, setRestockingItems] = useState<Set<string>>(new Set());
  const [restockSuccess, setRestockSuccess] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Handle message from navigation state (e.g., from teach mode)
  useEffect(() => {
    if (location.state?.message) {
      setLocationMessage(location.state.message);
      // Clear the state to prevent showing again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.message]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (locationMessage) {
      const timer = setTimeout(() => setLocationMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [locationMessage]);

  useEffect(() => {
    if (restockSuccess) {
      const timer = setTimeout(() => setRestockSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [restockSuccess]);

  // Calculate stats
  const stats = {
    totalItems: items.length,
    runningOutSoon: items.filter(item => {
      const urgency = calculateUrgency(item);
      return urgency.level === UrgencyLevel.CRITICAL || urgency.level === UrgencyLevel.HIGH;
    }).length,
    needsReview: items.filter(item => item.predictionConfidence === 'Low' || item.predictionConfidence === 'None').length,
    weeklySpend: 0, // TODO: Calculate from transactions
  };

  // Get items running out in 7 days, sorted by urgency
  const runningOutItems = items
    .filter(item => {
      if (!item.predictedRunOutDate) return false;
      const daysUntil = Math.ceil(
        (new Date(item.predictedRunOutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysUntil <= 7;
    })
    .sort((a, b) => {
      const daysA = a.predictedRunOutDate ? 
        Math.ceil((new Date(a.predictedRunOutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 999;
      const daysB = b.predictedRunOutDate ?
        Math.ceil((new Date(b.predictedRunOutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 999;
      return daysA - daysB;
    })
    .slice(0, 6);

  // Calculate confidence health
  const confidenceStats = {
    high: items.filter(i => i.predictionConfidence === 'High').length,
    medium: items.filter(i => i.predictionConfidence === 'Medium').length,
    low: items.filter(i => i.predictionConfidence === 'Low' || i.predictionConfidence === 'None').length,
  };
  const totalConfidenceItems = confidenceStats.high + confidenceStats.medium + confidenceStats.low;
  const healthScore = totalConfidenceItems > 0 
    ? Math.round(((confidenceStats.high * 1 + confidenceStats.medium * 0.7) / totalConfidenceItems) * 100)
    : 0;

  const lowConfidenceItems = items
    .filter(i => i.predictionConfidence === 'Low' || i.predictionConfidence === 'None')
    .slice(0, 3);

  /**
   * One-Tap Restock handler
   */
  const handleRestock = useCallback(async (itemId: string) => {
    if (restockingItems.has(itemId)) return;

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    setRestockingItems(prev => new Set(prev).add(itemId));

    try {
      await transactionsApi.restock({ itemId });
      setRestockSuccess(item.canonicalName);
      await syncItems();
    } catch (error) {
      console.error('Restock failed:', error);
      alert(`Failed to restock ${item.canonicalName}. Please try again.`);
    } finally {
      setRestockingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  }, [items, restockingItems, syncItems]);

  const handleViewDetails = (itemId: string) => {
    navigate(`/items/${itemId}`);
  };

  // Check if user has pending CSV
  const hasAwaitingCSV = localStorage.getItem('awaitingCSV') === 'true';

  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Success Messages */}
      {restockSuccess && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <RefreshCw className="h-4 w-4" />
          <span>Restocked {restockSuccess}!</span>
        </div>
      )}

      {locationMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <span>{locationMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">
            Welcome back{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-neutral-600 mt-1">Here's what needs your attention today</p>
        </div>
      </div>

      {/* CSV Pending Banner */}
      {hasAwaitingCSV && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Amazon CSV Ready to Upload?</p>
                <p className="text-sm text-blue-700">Check your email for the order history report</p>
              </div>
            </div>
            <Button onClick={() => navigate('/import')}>
              Upload Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/inventory')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{stats.totalItems}</p>
              <p className="text-sm text-neutral-600">Items Tracked</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer hover:shadow-md transition-shadow",
            stats.runningOutSoon > 0 && "border-red-200"
          )}
          onClick={() => navigate('/inventory')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", stats.runningOutSoon > 0 ? "bg-red-100" : "bg-neutral-100")}>
              <AlertTriangle className={cn("h-5 w-5", stats.runningOutSoon > 0 ? "text-red-600" : "text-neutral-600")} />
            </div>
            <div>
              <p className={cn("text-2xl font-bold", stats.runningOutSoon > 0 ? "text-red-600" : "text-neutral-900")}>
                {stats.runningOutSoon}
              </p>
              <p className="text-sm text-neutral-600">Running Out</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer hover:shadow-md transition-shadow",
            stats.needsReview > 0 && "border-yellow-200"
          )}
          onClick={() => navigate('/inventory')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", stats.needsReview > 0 ? "bg-yellow-100" : "bg-neutral-100")}>
              <TrendingUp className={cn("h-5 w-5", stats.needsReview > 0 ? "text-yellow-600" : "text-neutral-600")} />
            </div>
            <div>
              <p className={cn("text-2xl font-bold", stats.needsReview > 0 ? "text-yellow-600" : "text-neutral-900")}>
                {stats.needsReview}
              </p>
              <p className="text-sm text-neutral-600">Low Confidence</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">$—</p>
              <p className="text-sm text-neutral-600">This Week</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Running Out Soon */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neutral-900">Running Out Soon</h2>
          {runningOutItems.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')}>
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>

        {runningOutItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <span className="text-4xl mb-4 block">🎉</span>
              <h3 className="font-semibold text-neutral-900 mb-2">You're all stocked up!</h3>
              <p className="text-neutral-600">No items running out in the next 7 days</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {runningOutItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                variant="dashboard"
                onRestock={handleRestock}
                onViewDetails={handleViewDetails}
                isRestocking={restockingItems.has(item.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Confidence Coach */}
      {items.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-neutral-900">Confidence Coach</h2>
          </div>

          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-medium text-neutral-900">
                  Prediction Health Score
                </span>
                <span className="text-2xl font-bold text-neutral-900">{healthScore}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-3 bg-neutral-200 rounded-full overflow-hidden mb-6">
                <div 
                  className={cn(
                    "h-full transition-all duration-500",
                    healthScore >= 70 ? "bg-green-500" : healthScore >= 40 ? "bg-yellow-500" : "bg-red-500"
                  )}
                  style={{ width: `${healthScore}%` }}
                />
              </div>

              {/* Confidence breakdown */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <p className="text-xl font-bold text-green-600">{confidenceStats.high}</p>
                  <p className="text-sm text-neutral-600">High Confidence</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-yellow-600">{confidenceStats.medium}</p>
                  <p className="text-sm text-neutral-600">Medium</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-red-600">{confidenceStats.low}</p>
                  <p className="text-sm text-neutral-600">Low Confidence</p>
                </div>
              </div>

              {/* Improvement suggestions */}
              {lowConfidenceItems.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-neutral-700 mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Improve low-confidence items:
                  </p>
                  <div className="space-y-2">
                    {lowConfidenceItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg">
                        <span className="text-sm text-neutral-900">{item.canonicalName}</span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRestock(item.id)}
                          disabled={restockingItems.has(item.id)}
                        >
                          {restockingItems.has(item.id) ? 'Restocking...' : '+ Restock'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Quick Actions */}
      <section>
        <h2 className="text-xl font-semibold text-neutral-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate('/import')} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
          <Button variant="outline" onClick={() => navigate('/import')} className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload CSV
          </Button>
        </div>
      </section>

      {/* Empty State for new users */}
      {items.length === 0 && !isLoading && (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center">
            <span className="text-5xl mb-4 block">📦</span>
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">
              Your inventory is empty
            </h3>
            <p className="text-neutral-600 mb-6 max-w-md mx-auto">
              Get started by importing your Amazon order history or adding items manually.
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => navigate('/import')}>
                <Upload className="h-4 w-4 mr-2" />
                Import from Amazon
              </Button>
              <Button variant="outline" onClick={() => navigate('/onboarding/csv-wait')}>
                Add Manually
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
