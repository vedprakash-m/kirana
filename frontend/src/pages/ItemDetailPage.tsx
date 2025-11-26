import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { 
  ArrowLeft, 
  Edit2, 
  MoreVertical, 
  RefreshCw, 
  Trash2,
  Calendar,
  DollarSign,
  TrendingUp,
  Package,
  Clock,
  Loader2
} from 'lucide-react';
import { useItemsStore } from '@/store/itemsStore';
import { transactionsApi } from '@/services/transactionsApi';
import { itemsApi } from '@/services/itemsApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfidenceBadge } from '@/components/items/ConfidenceBadge';
import { calculateUrgency, UrgencyLevel } from '@/utils/urgencyCalculator';
import { cn } from '@/lib/utils';
import type { Item, Transaction } from '@/types/shared';

/**
 * ItemDetailPage - Detailed view of a single item
 * 
 * Per UX Spec Section 3.3:
 * - Status and prediction info
 * - Item details (category, unit, vendor, price)
 * - Purchase history
 * - Actions (restock, delete)
 */
export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items, loadItems, syncItems } = useItemsStore();
  
  const [item, setItem] = useState<Item | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestocking, setIsRestocking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [restockSuccess, setRestockSuccess] = useState(false);

  useEffect(() => {
    const foundItem = items.find(i => i.id === id);
    if (foundItem) {
      setItem(foundItem);
      setIsLoading(false);
    } else {
      // Try to load items if not found
      loadItems().then(() => {
        setIsLoading(false);
      });
    }
  }, [id, items, loadItems]);

  // Update item when items store changes
  useEffect(() => {
    const foundItem = items.find(i => i.id === id);
    if (foundItem) {
      setItem(foundItem);
    }
  }, [items, id]);

  // Load transaction history
  useEffect(() => {
    if (!item?.householdId) return;

    transactionsApi.getForItem(item.id, item.householdId)
      .then(setTransactions)
      .catch(console.error);
  }, [item?.id, item?.householdId]);

  // Clear success message
  useEffect(() => {
    if (restockSuccess) {
      const timer = setTimeout(() => setRestockSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [restockSuccess]);

  const handleRestock = useCallback(async () => {
    if (!item || isRestocking) return;

    setIsRestocking(true);
    try {
      await transactionsApi.restock({ itemId: item.id });
      setRestockSuccess(true);
      await syncItems();
      // Reload transactions
      const updatedTransactions = await transactionsApi.getForItem(item.id, item.householdId);
      setTransactions(updatedTransactions);
    } catch (error) {
      console.error('Restock failed:', error);
      alert('Failed to restock. Please try again.');
    } finally {
      setIsRestocking(false);
    }
  }, [item, isRestocking, syncItems]);

  const handleDelete = useCallback(async () => {
    if (!item || isDeleting) return;

    setIsDeleting(true);
    try {
      await itemsApi.delete(item.id, item.householdId);
      navigate('/inventory', { replace: true });
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete item. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [item, isDeleting, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-neutral-900 mb-2">Item Not Found</h2>
        <p className="text-neutral-600 mb-4">This item may have been deleted or doesn't exist.</p>
        <Button onClick={() => navigate('/inventory')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inventory
        </Button>
      </div>
    );
  }

  const urgency = calculateUrgency(item);

  // Get item emoji (simplified)
  const getItemEmoji = (item: Item): string => {
    const name = item.canonicalName.toLowerCase();
    if (name.includes('milk')) return '🥛';
    if (name.includes('bread')) return '🍞';
    if (name.includes('egg')) return '🥚';
    if (name.includes('rice')) return '🍚';
    if (name.includes('coffee')) return '☕';
    if (name.includes('chicken')) return '🍗';
    return '📦';
  };

  const getUrgencyColor = () => {
    switch (urgency.level) {
      case UrgencyLevel.CRITICAL:
      case UrgencyLevel.HIGH:
        return 'text-red-600 bg-red-50 border-red-200';
      case UrgencyLevel.MEDIUM:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case UrgencyLevel.LOW:
      case UrgencyLevel.NORMAL:
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-neutral-600 bg-neutral-50 border-neutral-200';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return '—';
    return `$${price.toFixed(2)}`;
  };

  // Calculate average frequency from transactions
  const calculateAvgFrequency = () => {
    if (transactions.length < 2) return null;
    const sortedDates = transactions
      .map(t => new Date(t.purchaseDate).getTime())
      .sort((a, b) => a - b);
    
    let totalDays = 0;
    for (let i = 1; i < sortedDates.length; i++) {
      totalDays += (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
    }
    return Math.round(totalDays / (sortedDates.length - 1));
  };

  const avgFrequency = calculateAvgFrequency();

  return (
    <div className="max-w-3xl mx-auto">
      {/* Success toast */}
      {restockSuccess && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <RefreshCw className="h-4 w-4" />
          <span>Restocked {item.canonicalName}!</span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardContent className="py-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">Delete Item?</h3>
              <p className="text-neutral-600 mb-6">
                This will remove <strong>{item.canonicalName}</strong> and all its purchase history. 
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{getItemEmoji(item)}</span>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">{item.canonicalName}</h1>
              {item.brand && <p className="text-neutral-600">{item.brand}</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/items/${item.id}/edit`)}>
            <Edit2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Status Card */}
      <Card className={cn("mb-6 border-2", getUrgencyColor())}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{urgency.emoji}</span>
                <span className="text-lg font-semibold">{urgency.message}</span>
              </div>
              {item.predictedRunOutDate && (
                <p className="text-sm opacity-80">
                  Expected run-out: {formatDate(item.predictedRunOutDate)}
                </p>
              )}
            </div>
            <ConfidenceBadge confidence={item.predictionConfidence || 'None'} />
          </div>
        </CardContent>
      </Card>

      {/* Item Details */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <h2 className="font-semibold text-neutral-900 mb-4">Item Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neutral-100 rounded-lg">
                <Package className="h-5 w-5 text-neutral-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-500">Category</p>
                <p className="font-medium text-neutral-900">{item.category}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neutral-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-neutral-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-500">Unit</p>
                <p className="font-medium text-neutral-900">
                  {item.packageUnit || 'unit'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neutral-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-neutral-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-500">Last Price</p>
                <p className="font-medium text-neutral-900">
                  {formatPrice(item.lastPurchasePrice)}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neutral-100 rounded-lg">
                <Clock className="h-5 w-5 text-neutral-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-500">Avg. Frequency</p>
                <p className="font-medium text-neutral-900">
                  {avgFrequency ? `Every ${avgFrequency} days` : '—'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Purchase History */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-neutral-900">Purchase History</h2>
            {transactions.length > 5 && (
              <Button variant="ghost" size="sm">
                View All {transactions.length}
              </Button>
            )}
          </div>
          
          {transactions.length === 0 ? (
            <p className="text-neutral-500 text-center py-4">
              No purchases recorded yet
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-neutral-400" />
                    <span className="text-neutral-900">{formatDate(transaction.purchaseDate)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-neutral-900">
                      {formatPrice(transaction.totalPrice)}
                    </span>
                    {transaction.vendor && (
                      <span className="text-sm text-neutral-500 ml-2">
                        · {transaction.vendor}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-3">
        <Button 
          className="w-full" 
          size="lg"
          onClick={handleRestock}
          disabled={isRestocking}
        >
          {isRestocking ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Restocking...
            </>
          ) : (
            <>
              <RefreshCw className="h-5 w-5 mr-2" />
              One-Tap Restock
            </>
          )}
        </Button>
        
        <Button 
          variant="outline" 
          className="w-full" 
          size="lg"
          onClick={() => navigate(`/items/${item.id}/purchase`)}
        >
          <DollarSign className="h-5 w-5 mr-2" />
          Record Custom Purchase
        </Button>
        
        <Button 
          variant="ghost" 
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" 
          size="lg"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className="h-5 w-5 mr-2" />
          Delete Item
        </Button>
      </div>
    </div>
  );
}
