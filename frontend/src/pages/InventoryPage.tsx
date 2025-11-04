import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useItemsStore } from '@/store/itemsStore';
import { ItemCard } from '@/components/items/ItemCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UrgencyLevel } from '@/types/shared';

/**
 * InventoryPage - Full inventory list with filtering and sorting
 * 
 * Features:
 * - Display all items in compact card view
 * - Search and filter capabilities
 * - Sort by run-out date, name, category
 * - One-Tap Restock integration
 * - Empty state for new users
 */
export function InventoryPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { 
    items, 
    isLoading, 
    error, 
    loadItems,
  } = useItemsStore();

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Calculate urgency level for each item
  const getUrgencyLevel = (predictedRunOutDate?: string): UrgencyLevel => {
    if (!predictedRunOutDate) return UrgencyLevel.UNKNOWN;
    
    const daysUntil = Math.ceil(
      (new Date(predictedRunOutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntil <= 2) return UrgencyLevel.CRITICAL;
    if (daysUntil <= 5) return UrgencyLevel.WARNING;
    if (daysUntil > 5) return UrgencyLevel.HEALTHY;
    return UrgencyLevel.UNKNOWN;
  };

  // Filter items based on search
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.canonicalName.toLowerCase().includes(query) ||
      item.brand?.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  });

  // Sort by urgency (critical first)
  const sortedItems = [...filteredItems].sort((a, b) => {
    const urgencyOrder = { 
      [UrgencyLevel.CRITICAL]: 0, 
      [UrgencyLevel.WARNING]: 1, 
      [UrgencyLevel.HEALTHY]: 2, 
      [UrgencyLevel.UNKNOWN]: 3 
    };
    const urgencyA = getUrgencyLevel(a.predictedRunOutDate);
    const urgencyB = getUrgencyLevel(b.predictedRunOutDate);
    return urgencyOrder[urgencyA] - urgencyOrder[urgencyB];
  });

  const handleRestock = async (itemId: string) => {
    // TODO: Implement One-Tap Restock (will call transactionsApi.restock)
    console.log('Restock item:', itemId);
  };

  const handleViewDetails = (itemId: string) => {
    navigate(`/items/${itemId}`);
  };

  const handleAddItem = () => {
    navigate('/import');
  };

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-neutral-900 mb-6">Inventory</h1>
        <EmptyState
          variant="error"
          title="Failed to load inventory"
          description={error}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Inventory</h1>
        <Button onClick={handleAddItem}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search items by name, brand, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
          />
        </div>
      </div>

      {/* Stats Summary */}
      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-neutral-200">
            <div className="text-2xl font-bold text-neutral-900">{items.length}</div>
            <div className="text-sm text-neutral-600">Total Items</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-neutral-200">
            <div className="text-2xl font-bold text-urgency-critical">
              {items.filter(i => getUrgencyLevel(i.predictedRunOutDate) === 'critical').length}
            </div>
            <div className="text-sm text-neutral-600">Running Out Soon</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-neutral-200">
            <div className="text-2xl font-bold text-urgency-warning">
              {items.filter(i => i.predictionConfidence === 'Low').length}
            </div>
            <div className="text-sm text-neutral-600">Low Confidence</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4 rounded-lg border border-neutral-200">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && (
        <EmptyState
          variant="no-items"
          title="No items in inventory"
          description="Get started by adding your first item. You can import from CSV or add items manually."
          actionLabel="Add Your First Item"
          onAction={handleAddItem}
        />
      )}

      {/* No Search Results */}
      {!isLoading && items.length > 0 && filteredItems.length === 0 && (
        <EmptyState
          variant="no-results"
          title="No items found"
          description={`No items match "${searchQuery}". Try a different search term.`}
        />
      )}

      {/* Item List */}
      {!isLoading && sortedItems.length > 0 && (
        <div className="space-y-4">
          {sortedItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              variant="compact"
              onRestock={handleRestock}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      {/* Results Count */}
      {!isLoading && sortedItems.length > 0 && searchQuery && (
        <div className="mt-4 text-sm text-neutral-600 text-center">
          Showing {sortedItems.length} of {items.length} items
        </div>
      )}
    </div>
  );
}
