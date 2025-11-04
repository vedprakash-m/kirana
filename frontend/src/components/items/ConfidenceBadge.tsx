import type { PredictionConfidence } from '@/types/shared';
import { Badge } from '@/components/ui/badge';

interface ConfidenceBadgeProps {
  confidence: PredictionConfidence;
  className?: string;
}

/**
 * ConfidenceBadge - Displays prediction confidence level with appropriate color coding
 * 
 * Color mapping (UX Spec 6.1):
 * - High: Green (#10B981)
 * - Medium: Yellow (#F59E0B)
 * - Low: Red (#EF4444)
 * - None: Gray (#9CA3AF)
 */
export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  const getVariant = () => {
    switch (confidence) {
      case 'High':
        return 'success';
      case 'Medium':
        return 'warning';
      case 'Low':
        return 'destructive';
      case 'None':
      default:
        return 'secondary';
    }
  };

  const getLabel = () => {
    switch (confidence) {
      case 'High':
        return 'High Confidence';
      case 'Medium':
        return 'Medium Confidence';
      case 'Low':
        return 'Low Confidence';
      case 'None':
      default:
        return 'No Prediction';
    }
  };

  return (
    <Badge variant={getVariant()} className={className}>
      {getLabel()}
    </Badge>
  );
}
