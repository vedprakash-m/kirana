import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CSVUploadBannerProps {
  className?: string;
}

export function CSVUploadBanner({ className }: CSVUploadBannerProps) {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [itemsAdded, setItemsAdded] = useState(0);
  const [isDismissedTemporarily, setIsDismissedTemporarily] = useState(false);

  useEffect(() => {
    // Check if awaiting CSV upload
    const awaitingCSV = localStorage.getItem('awaitingCSV');
    const teachModeItems = localStorage.getItem('teachModeItemsAdded');
    const permanentlyDismissed = localStorage.getItem('csvBannerDismissedPermanently');
    
    // Only show if:
    // 1. User is awaiting CSV
    // 2. Haven't permanently dismissed
    // 3. Haven't temporarily dismissed in this session
    if (awaitingCSV === 'true' && !permanentlyDismissed && !isDismissedTemporarily) {
      setIsVisible(true);
      setItemsAdded(parseInt(teachModeItems || '0', 10));
    }
  }, [isDismissedTemporarily]);

  const handleUploadClick = () => {
    navigate('/import');
  };

  const handleDismissTemporarily = () => {
    setIsDismissedTemporarily(true);
    setIsVisible(false);
  };

  const handleDismissPermanently = () => {
    localStorage.setItem('csvBannerDismissedPermanently', 'true');
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'bg-amber-50 border-l-4 border-amber-400 p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <Upload className="w-5 h-5 text-amber-600" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-amber-900 text-base">
                📧 Your Amazon CSV is ready!
              </h3>
              <p className="text-sm text-amber-800">
                {itemsAdded > 0 ? (
                  <>
                    You have <strong>{itemsAdded} {itemsAdded === 1 ? 'item' : 'items'}</strong> with
                    predictions. Upload your CSV to get comprehensive coverage.
                  </>
                ) : (
                  <>
                    Your Amazon order report should have arrived by email. Upload it to
                    get instant predictions for all your purchases!
                  </>
                )}
              </p>

              {/* Time estimate */}
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <Clock className="w-3.5 h-3.5" />
                <span>Takes less than 1 minute</span>
              </div>
            </div>

            {/* Dismiss button (desktop) */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismissPermanently}
              className="shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100 hidden sm:flex"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              onClick={handleUploadClick}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload CSV Now
            </Button>
            <Button
              variant="outline"
              onClick={handleDismissTemporarily}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Later
            </Button>
            <Button
              variant="ghost"
              onClick={handleDismissPermanently}
              className="text-amber-600 hover:bg-amber-100 sm:hidden"
            >
              Don't show again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
