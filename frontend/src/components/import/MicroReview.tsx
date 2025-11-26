import { useState, useCallback } from 'react';
import { X, Check, Edit2, SkipForward, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { ConfidenceBadge } from '@/components/items/ConfidenceBadge';
import { cn } from '@/lib/utils';
import type { PredictionConfidence } from '@/types/shared';
import { PredictionConfidence as PC } from '@/types/shared';

/**
 * ParsedItem - An item parsed from CSV that needs review
 */
export interface ParsedItem {
  id: string;
  itemName: string;
  brand?: string;
  quantity: number;
  unit: string;
  price?: number;
  confidence: number;  // 0-100
  originalText: string;
  category?: string;
}

/**
 * ReviewDecision - User's decision on a parsed item
 */
export type ReviewDecision = 'accept' | 'edit' | 'reject' | 'skip';

export interface ReviewResult {
  itemId: string;
  decision: ReviewDecision;
  editedItem?: Partial<ParsedItem>;
}

interface MicroReviewProps {
  items: ParsedItem[];
  onComplete: (results: ReviewResult[]) => void;
  onClose: () => void;
  className?: string;
}

/**
 * MicroReview - Bottom sheet for reviewing ambiguous CSV items
 * 
 * Per UX Spec Section 3.4:
 * - Shows one item at a time
 * - Accept, Edit, Reject, or Skip options
 * - Progress indicator
 * - Edit mode for corrections
 */
export function MicroReview({ items, onComplete, className }: Omit<MicroReviewProps, 'onClose'> & { onClose?: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedItem, setEditedItem] = useState<Partial<ParsedItem>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentItem = items[currentIndex];
  const totalItems = items.length;
  const isLastItem = currentIndex === totalItems - 1;

  const getConfidenceLevel = (confidence: number): PredictionConfidence => {
    if (confidence >= 85) return PC.HIGH;
    if (confidence >= 65) return PC.MEDIUM;
    if (confidence >= 40) return PC.LOW;
    return PC.NONE;
  };

  const handleDecision = useCallback((decision: ReviewDecision) => {
    const result: ReviewResult = {
      itemId: currentItem.id,
      decision,
      editedItem: decision === 'edit' ? editedItem : undefined,
    };

    const newResults = [...results, result];
    setResults(newResults);

    if (isLastItem) {
      setIsSubmitting(true);
      onComplete(newResults);
    } else {
      setCurrentIndex(currentIndex + 1);
      setIsEditMode(false);
      setEditedItem({});
    }
  }, [currentItem, currentIndex, isLastItem, results, editedItem, onComplete]);

  const handleSkip = () => {
    handleDecision('skip');
  };

  const handleAccept = () => {
    handleDecision('accept');
  };

  const handleReject = () => {
    handleDecision('reject');
  };

  const handleEdit = () => {
    setIsEditMode(true);
    setEditedItem({
      itemName: currentItem.itemName,
      brand: currentItem.brand,
      quantity: currentItem.quantity,
      unit: currentItem.unit,
      price: currentItem.price,
    });
  };

  const handleSaveEdit = () => {
    handleDecision('edit');
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedItem({});
  };

  if (!currentItem) {
    return null;
  }

  return (
    <div className={cn(
      "fixed inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[80vh] overflow-y-auto",
      "animate-in slide-in-from-bottom duration-300",
      className
    )}>
      {/* Handle bar for mobile */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 bg-neutral-300 rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-3 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-600">
            Review Item {currentIndex + 1} of {totalItems}
          </span>
          {/* Progress dots */}
          <div className="flex gap-1 ml-2">
            {items.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full",
                  i === currentIndex ? "bg-blue-600" : 
                  i < currentIndex ? "bg-green-500" : "bg-neutral-300"
                )}
              />
            ))}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSkip}>
          Skip <SkipForward className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <CardContent className="py-6">
        {!isEditMode ? (
          // View Mode
          <>
            <p className="text-sm text-neutral-500 mb-4">
              We parsed this from your receipt:
            </p>

            <div className="bg-neutral-50 rounded-lg p-4 mb-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Item:</span>
                  <span className="font-medium text-neutral-900">{currentItem.itemName}</span>
                </div>
                {currentItem.brand && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Brand:</span>
                    <span className="font-medium text-neutral-900">{currentItem.brand}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">Quantity:</span>
                  <span className="font-medium text-neutral-900">{currentItem.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Unit:</span>
                  <span className="font-medium text-neutral-900">{currentItem.unit}</span>
                </div>
                {currentItem.price !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Price:</span>
                    <span className="font-medium text-neutral-900">${currentItem.price.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Confidence:</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium",
                      currentItem.confidence >= 85 ? "text-green-600" :
                      currentItem.confidence >= 65 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {currentItem.confidence}%
                    </span>
                    <ConfidenceBadge confidence={getConfidenceLevel(currentItem.confidence)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Original text */}
            <div className="mb-6">
              <p className="text-xs text-neutral-500 mb-1">Original text:</p>
              <p className="text-sm text-neutral-700 bg-neutral-100 px-3 py-2 rounded font-mono">
                "{currentItem.originalText}"
              </p>
            </div>

            {/* Action Buttons */}
            <p className="text-sm font-medium text-neutral-700 mb-3">
              Does this look correct?
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Button 
                variant="default" 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleAccept}
              >
                <Check className="h-4 w-4 mr-2" />
                Accept
              </Button>
              <Button 
                variant="outline"
                onClick={handleEdit}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleReject}
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </>
        ) : (
          // Edit Mode
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-neutral-700">
                Edit item details:
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Item Name</label>
                <input
                  type="text"
                  value={editedItem.itemName || ''}
                  onChange={(e) => setEditedItem({ ...editedItem, itemName: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Brand</label>
                <input
                  type="text"
                  value={editedItem.brand || ''}
                  onChange={(e) => setEditedItem({ ...editedItem, brand: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={editedItem.quantity || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">Unit</label>
                  <input
                    type="text"
                    value={editedItem.unit || ''}
                    onChange={(e) => setEditedItem({ ...editedItem, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={editedItem.price || ''}
                  onChange={(e) => setEditedItem({ ...editedItem, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Original text reference */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-neutral-500">Original: "{currentItem.originalText}"</p>
            </div>
          </>
        )}
      </CardContent>

      {/* Loading overlay */}
      {isSubmitting && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-2" />
            <p className="text-neutral-600">Saving your reviews...</p>
          </div>
        </div>
      )}
    </div>
  );
}
