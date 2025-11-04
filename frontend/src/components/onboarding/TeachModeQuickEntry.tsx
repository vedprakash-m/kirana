import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Common items to suggest (localized - US version)
const SUGGESTED_ITEMS = [
  { name: 'Milk', emoji: '🥛', category: 'Dairy & Eggs' },
  { name: 'Eggs', emoji: '🥚', category: 'Dairy & Eggs' },
  { name: 'Bread', emoji: '🍞', category: 'Bakery' },
  { name: 'Bananas', emoji: '🍌', category: 'Produce' },
  { name: 'Coffee', emoji: '☕', category: 'Beverages' },
  { name: 'Chicken', emoji: '🍗', category: 'Meat & Seafood' },
] as const;

// Frequency options for teach mode
const FREQUENCY_OPTIONS = [
  { label: 'Daily', days: 1, shortLabel: 'Every day' },
  { label: 'Weekly', days: 7, shortLabel: 'Every 7 days' },
  { label: 'Biweekly', days: 14, shortLabel: 'Every 14 days' },
  { label: 'Monthly', days: 30, shortLabel: 'Every 30 days' },
] as const;

interface TeachModeItem {
  name: string;
  emoji: string;
  category: string;
  frequency: number;
  frequencyLabel: string;
  lastPurchaseDate: string;
  predictedRunOutDate: string;
}

interface TeachModeQuickEntryProps {
  onComplete: (items: TeachModeItem[]) => void;
  onSkip?: () => void;
  minItems?: number;
  maxItems?: number;
  className?: string;
}

export function TeachModeQuickEntry({
  onComplete,
  onSkip,
  minItems = 1,
  maxItems = 8,
  className,
}: TeachModeQuickEntryProps) {
  const [addedItems, setAddedItems] = useState<TeachModeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<{
    name: string;
    emoji: string;
    category: string;
  } | null>(null);
  const [customItemName, setCustomItemName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate predicted run-out date based on frequency
  const calculatePredictedDate = (days: number): string => {
    const today = new Date();
    const predicted = new Date(today);
    predicted.setDate(predicted.getDate() + days);
    return predicted.toISOString().split('T')[0];
  };

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  // Handle selecting a suggested item
  const handleSelectItem = (item: typeof SUGGESTED_ITEMS[number]) => {
    // Check if already added
    if (addedItems.some((i) => i.name === item.name)) {
      return;
    }

    // Check max items
    if (addedItems.length >= maxItems) {
      return;
    }

    setSelectedItem({ name: item.name, emoji: item.emoji, category: item.category });
    setShowCustomInput(false);
    setCustomItemName('');
  };

  // Handle "Other" button
  const handleOtherClick = () => {
    if (addedItems.length >= maxItems) {
      return;
    }
    setShowCustomInput(true);
    setSelectedItem(null);
  };

  // Handle custom item submit
  const handleCustomItemSubmit = () => {
    if (!customItemName.trim()) return;

    // Check if already added
    if (addedItems.some((i) => i.name.toLowerCase() === customItemName.toLowerCase())) {
      return;
    }

    setSelectedItem({
      name: customItemName.trim(),
      emoji: '🛒',
      category: 'Other',
    });
    setShowCustomInput(false);
  };

  // Handle frequency selection
  const handleFrequencySelect = (frequency: typeof FREQUENCY_OPTIONS[number]) => {
    if (!selectedItem) return;

    const today = getTodayDate();
    const predictedDate = calculatePredictedDate(frequency.days);

    const newItem: TeachModeItem = {
      name: selectedItem.name,
      emoji: selectedItem.emoji,
      category: selectedItem.category,
      frequency: frequency.days,
      frequencyLabel: frequency.label.toLowerCase(),
      lastPurchaseDate: today,
      predictedRunOutDate: predictedDate,
    };

    setAddedItems([...addedItems, newItem]);
    setSelectedItem(null);
    setCustomItemName('');
  };

  // Handle removing an added item
  const handleRemoveItem = (itemName: string) => {
    setAddedItems(addedItems.filter((i) => i.name !== itemName));
  };

  // Handle completion
  const handleComplete = async () => {
    if (addedItems.length < minItems) return;

    setIsSubmitting(true);
    try {
      await onComplete(addedItems);
    } catch (error) {
      console.error('Error completing teach mode:', error);
      setIsSubmitting(false);
    }
  };

  // Calculate days label
  const getDaysLabel = (days: number): string => {
    if (days === 1) return '1 day';
    if (days === 7) return '7 days';
    if (days === 14) return '14 days';
    if (days === 30) return '30 days';
    return `${days} days`;
  };

  // Get available suggested items (not yet added)
  const availableSuggestions = SUGGESTED_ITEMS.filter(
    (item) => !addedItems.some((i) => i.name === item.name)
  );

  const canAddMore = addedItems.length < maxItems;
  const canComplete = addedItems.length >= minItems;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Let's get your first predictions!
        </h2>
        <p className="text-gray-600">
          Tap items you buy often, set frequency, done. We'll give you instant predictions.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">
          {addedItems.length} of {minItems}-{maxItems} items
        </span>
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(addedItems.length / maxItems) * 100}%` }}
          />
        </div>
      </div>

      {/* Suggested items chips */}
      {canAddMore && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Common items (tap to add):
          </p>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.map((item) => (
              <Button
                key={item.name}
                variant="outline"
                size="sm"
                onClick={() => handleSelectItem(item)}
                className="h-10"
              >
                <span className="mr-1">{item.emoji}</span>
                {item.name}
              </Button>
            ))}
            {!showCustomInput && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOtherClick}
                className="h-10"
              >
                <Plus className="w-4 h-4 mr-1" />
                Other
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Custom item input */}
      {showCustomInput && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter item name..."
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCustomItemSubmit();
                }
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleCustomItemSubmit}
              disabled={!customItemName.trim()}
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCustomInput(false);
                setCustomItemName('');
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Frequency picker (shown when item is selected) */}
      {selectedItem && (
        <Card className="p-4 space-y-4 border-2 border-blue-500 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedItem.emoji}</span>
              <span className="font-semibold text-lg">{selectedItem.name}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedItem(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              How often do you buy this?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FREQUENCY_OPTIONS.map((freq) => (
                <Button
                  key={freq.label}
                  variant="outline"
                  onClick={() => handleFrequencySelect(freq)}
                  className="h-auto py-3 flex-col items-start"
                >
                  <span className="font-semibold">{freq.shortLabel}</span>
                  <span className="text-xs text-gray-500">
                    Predicted: {getDaysLabel(freq.days)}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              💡 We'll show you when you're about to run out!
            </p>
          </div>
        </Card>
      )}

      {/* Added items list */}
      {addedItems.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Items added:</p>
          <div className="space-y-2">
            {addedItems.map((item) => (
              <Card key={item.name} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.emoji}</span>
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        Every {getDaysLabel(item.frequency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      🎓 Learning
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveItem(item.name)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          onClick={handleComplete}
          disabled={!canComplete || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            'Creating predictions...'
          ) : (
            <>
              Done - See My Predictions
              {canComplete && (
                <span className="ml-2 text-xs opacity-80">
                  ({addedItems.length} {addedItems.length === 1 ? 'item' : 'items'})
                </span>
              )}
            </>
          )}
        </Button>

        {onSkip && (
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isSubmitting}
            className="w-full"
          >
            Skip for now
          </Button>
        )}
      </div>

      {/* Helper text */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
        <p className="text-sm text-gray-700">
          💡 <strong>Don't worry about being exact!</strong> Our predictions improve over
          time as we learn your actual buying patterns.
        </p>
      </div>
    </div>
  );
}
