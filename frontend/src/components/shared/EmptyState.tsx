import { PackageOpen, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  variant: 'no-items' | 'no-results' | 'error';
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * EmptyState - Displays empty state messages with appropriate icons and actions
 * 
 * Variants:
 * - no-items: Used when inventory is empty (first-time user)
 * - no-results: Used when search/filter returns no results
 * - error: Used when an error occurs
 */
export function EmptyState({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const getIcon = () => {
    switch (variant) {
      case 'no-items':
        return <PackageOpen className="h-12 w-12 text-neutral-400" />;
      case 'no-results':
        return <FileText className="h-12 w-12 text-neutral-400" />;
      case 'error':
        return <AlertCircle className="h-12 w-12 text-urgency-critical" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div className="mb-4">{getIcon()}</div>
      
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-neutral-500 max-w-sm mb-6">
          {description}
        </p>
      )}
      
      {actionLabel && onAction && (
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
