import { MoreVertical, Calendar, Loader2 } from 'lucide-react';
import type { Item } from '@/types/shared';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfidenceBadge } from '@/components/items/ConfidenceBadge';
import { calculateUrgency, UrgencyLevel } from '@/utils/urgencyCalculator';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  item: Item;
  variant: 'compact' | 'dashboard' | 'grid';
  onRestock?: (itemId: string) => void;
  onViewDetails?: (itemId: string) => void;
  onMenuClick?: (itemId: string) => void;
  isRestocking?: boolean;
  className?: string;
}

/**
 * Get emoji representation for an item based on its category and name
 */
function getItemEmoji(item: Item): string {
  // Try to infer from canonical name first
  const name = item.canonicalName.toLowerCase();
  if (name.includes('milk')) return '🥛';
  if (name.includes('bread')) return '🍞';
  if (name.includes('egg')) return '🥚';
  if (name.includes('rice')) return '🍚';
  if (name.includes('apple')) return '🍎';
  if (name.includes('banana')) return '🍌';
  if (name.includes('tomato')) return '🍅';
  if (name.includes('potato')) return '🥔';
  if (name.includes('cheese')) return '🧀';
  if (name.includes('butter')) return '🧈';
  if (name.includes('yogurt')) return '🥛';
  if (name.includes('chicken')) return '🍗';
  if (name.includes('beef')) return '🥩';
  if (name.includes('fish')) return '🐟';
  if (name.includes('pasta')) return '🍝';
  if (name.includes('cereal')) return '🥣';
  if (name.includes('coffee')) return '☕';
  if (name.includes('tea')) return '🍵';
  
  // Fall back to category
  switch (item.category) {
    case 'Dairy & Eggs': return '🥛';
    case 'Produce': return '🥬';
    case 'Meat & Seafood': return '🥩';
    case 'Bakery': return '🍞';
    case 'Pantry Staples': return '🥫';
    case 'Beverages': return '🥤';
    case 'Snacks': return '🍪';
    case 'Frozen Foods': return '🧊';
    case 'Personal Care': return '🧴';
    case 'Household Supplies': return '🧹';
    case 'Pet Supplies': return '🐾';
    case 'Baby Products': return '🍼';
    case 'Other': 
    default: 
      return '📦';
  }
}

/**
 * ItemCard - Reusable component for displaying inventory items
 * 
 * Three variants (UX Spec 4.1):
 * - compact: List view with full details and actions (min-height: 120px)
 * - dashboard: Featured view with urgency-colored border (200px × 240px)
 * - grid: Minimal shopping list view (120px × 140px mobile, 160px × 180px desktop)
 * 
 * Features:
 * - Dynamic urgency color border (red/yellow/green based on run-out date)
 * - One-Tap Restock button
 * - Confidence badge
 * - Last purchase date and price
 */
export function ItemCard({
  item,
  variant,
  onRestock,
  onViewDetails,
  onMenuClick,
  isRestocking = false,
  className,
}: ItemCardProps) {
  // Calculate urgency using the new dynamic urgency calculator
  const urgency = calculateUrgency(item);

  // Get border class based on urgency level (4px left border for visual hierarchy)
  const getUrgencyBorderClass = () => {
    switch (urgency.level) {
      case UrgencyLevel.CRITICAL:
      case UrgencyLevel.HIGH:
        return 'border-l-[#DC2626]'; // red-600
      case UrgencyLevel.MEDIUM:
        return 'border-l-[#F59E0B]'; // amber-500
      case UrgencyLevel.LOW:
        return 'border-l-[#10B981]'; // emerald-500
      case UrgencyLevel.NORMAL:
      default:
        return 'border-l-neutral-200';
    }
  };

  const getUrgencyBgGradient = () => {
    switch (urgency.level) {
      case UrgencyLevel.CRITICAL:
      case UrgencyLevel.HIGH:
        return 'bg-gradient-to-br from-red-50 to-white';
      case UrgencyLevel.MEDIUM:
        return 'bg-gradient-to-br from-yellow-50 to-white';
      case UrgencyLevel.LOW:
        return 'bg-gradient-to-br from-green-50 to-white';
      default:
        return 'bg-white';
    }
  };

  const getUrgencyTextColor = () => {
    switch (urgency.level) {
      case UrgencyLevel.CRITICAL:
      case UrgencyLevel.HIGH:
        return 'text-[#DC2626]'; // red-600
      case UrgencyLevel.MEDIUM:
        return 'text-[#F59E0B]'; // amber-500
      case UrgencyLevel.LOW:
        return 'text-[#10B981]'; // emerald-500
      default:
        return 'text-neutral-600';
    }
  };

  const formatLastPurchase = () => {
    if (!item.lastPurchaseDate) {
      return null;
    }

    const date = new Date(item.lastPurchaseDate);
    const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    let priceText = '';
    if (item.lastPurchasePrice && item.packageUnit) {
      priceText = ` · $${item.lastPurchasePrice.toFixed(2)}/${item.packageUnit}`;
    }

    return `Last purchase: ${formatted}${priceText}`;
  };

  // Compact variant - List view
  if (variant === 'compact') {
    return (
      <Card
        className={cn(
          'hover:shadow-md transition-shadow cursor-pointer min-h-[120px] border-l-4',
          getUrgencyBorderClass(),
          className
        )}
        onClick={() => onViewDetails?.(item.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{getItemEmoji(item)}</span>
                <div>
                  <h3 className="font-semibold text-neutral-900">
                    {item.canonicalName}
                  </h3>
                  {item.brand && (
                    <p className="text-sm text-neutral-500">{item.brand}</p>
                  )}
                </div>
              </div>
            </div>
            
            {onMenuClick && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onMenuClick(item.id);
                }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="flex items-center gap-1">
              <span className="text-lg">{urgency.emoji}</span>
              <span className={cn('font-medium', getUrgencyTextColor())}>
                {urgency.message}
              </span>
            </span>
            <span className="text-neutral-400">·</span>
            <ConfidenceBadge confidence={item.predictionConfidence || 'None'} />
          </div>

          {formatLastPurchase() && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-3">
              <Calendar className="h-3 w-3" />
              <span>{formatLastPurchase()}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-4 pt-0 flex gap-2">
          {onRestock && (
            <Button
              size="sm"
              disabled={isRestocking}
              onClick={(e) => {
                e.stopPropagation();
                onRestock(item.id);
              }}
            >
              {isRestocking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restocking...
                </>
              ) : (
                'One-Tap Restock'
              )}
            </Button>
          )}
          {onViewDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(item.id);
              }}
            >
              View Details →
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Dashboard variant - Featured view
  if (variant === 'dashboard') {
    return (
      <Card
        className={cn(
          'w-[200px] h-60 hover:shadow-lg transition-all cursor-pointer border-l-4',
          getUrgencyBorderClass(),
          getUrgencyBgGradient(),
          className
        )}
        onClick={() => onViewDetails?.(item.id)}
      >
        <CardContent className="p-5 flex flex-col h-full">
          <div className="text-center mb-3">
            <span className="text-4xl mb-2 block">{getItemEmoji(item)}</span>
            <h3 className="font-semibold text-neutral-900 line-clamp-2 mb-1">
              {item.canonicalName}
            </h3>
            {item.brand && (
              <p className="text-xs text-neutral-500 line-clamp-1">{item.brand}</p>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center items-center mb-3">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-2xl">{urgency.emoji}</span>
              <div className={cn('text-sm font-bold text-center', getUrgencyTextColor())}>
                {urgency.message}
              </div>
            </div>
            <ConfidenceBadge confidence={item.predictionConfidence || 'None'} />
          </div>

          {onRestock && (
            <Button
              size="sm"
              className="w-full"
              disabled={isRestocking}
              onClick={(e) => {
                e.stopPropagation();
                onRestock(item.id);
              }}
            >
              {isRestocking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restocking...
                </>
              ) : (
                'One-Tap Restock'
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Grid variant - Minimal shopping list view
  return (
    <Card
      className={cn(
        'w-[120px] h-[140px] md:w-40 md:h-[180px] hover:shadow-md transition-shadow cursor-pointer border-l-4',
        getUrgencyBorderClass(),
        className
      )}
      onClick={() => onViewDetails?.(item.id)}
    >
      <CardContent className="p-4 flex flex-col items-center justify-between h-full">
        <span className="text-5xl md:text-6xl mb-2">{getItemEmoji(item)}</span>
        
        <h3 className="font-medium text-sm md:text-base text-neutral-900 text-center line-clamp-2 mb-2">
          {item.canonicalName}
        </h3>

        <div className="flex items-center gap-1 mb-3">
          <span className="text-lg">{urgency.emoji}</span>
          <div className={cn('text-xs md:text-sm font-medium', getUrgencyTextColor())}>
            {urgency.daysRemaining} days
          </div>
        </div>

        {onRestock && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            disabled={isRestocking}
            onClick={(e) => {
              e.stopPropagation();
              onRestock(item.id);
            }}
          >
            {isRestocking ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              '✓ Add'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
