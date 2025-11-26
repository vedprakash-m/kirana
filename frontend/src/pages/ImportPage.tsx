import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  ExternalLink,
  HelpCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { parsingApi } from '@/services/parsingApi';
import type { ParseJobResponse } from '@/services/parsingApi';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

type ImportStep = 'select-retailer' | 'upload' | 'processing' | 'complete';
type Retailer = 'amazon' | 'costco' | 'instacart' | 'other';

interface RetailerInfo {
  id: Retailer;
  name: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

const RETAILERS: RetailerInfo[] = [
  { 
    id: 'amazon', 
    name: 'Amazon', 
    description: 'Best for starting out (12 months of data)',
    badge: '🌟 Recommended',
    badgeColor: 'bg-yellow-100 text-yellow-800'
  },
  { 
    id: 'costco', 
    name: 'Costco', 
    description: 'Bulk orders and receipts',
    badge: '✓ Supported',
    badgeColor: 'bg-green-100 text-green-800'
  },
  { 
    id: 'instacart', 
    name: 'Instacart', 
    description: 'Grocery delivery orders',
    badge: '🧪 Beta',
    badgeColor: 'bg-purple-100 text-purple-800'
  },
  { 
    id: 'other', 
    name: 'Other', 
    description: 'AI parsing (may be slower)',
  },
];

const AMAZON_INSTRUCTIONS = [
  'Go to Amazon.com and sign in',
  'Click "Account & Lists" → "Your Account"',
  'Scroll down to "Ordering and shopping preferences"',
  'Click "Download order reports"',
  'Select "Items" report type',
  'Choose "Last 12 months" date range',
  'Click "Request Report"',
  'Wait for email (usually 5-10 minutes)',
  'Download the CSV from the email link',
];

/**
 * ImportPage - CSV upload and micro-review interface
 * 
 * Per UX Spec Section 3.4:
 * - Step 1: Choose retailer
 * - Step 2: Upload file (drag-drop)
 * - Processing: Real-time progress
 * - Complete: Summary with review CTA
 */
export function ImportPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('select-retailer');
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<ParseJobResponse | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Poll for job status
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await parsingApi.getJob(currentJob.jobId);
        setCurrentJob(updatedJob);

        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
          setStep('complete');
        }
      } catch (error) {
        console.error('Failed to poll job status:', error);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [currentJob]);

  const handleRetailerSelect = (retailer: Retailer) => {
    setSelectedRetailer(retailer);
    setStep('upload');
  };

  const handleFileUpload = useCallback(async (file: File) => {
    if (!user?.id) {
      setUploadError('Please sign in to upload files');
      return;
    }

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.txt')) {
      setUploadError('Please upload a CSV, XLSX, or TXT file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      setUploadError('File is too large. Maximum size is 10MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await parsingApi.uploadCSV(file, selectedRetailer || 'other');
      // Get the job to start polling
      const job = await parsingApi.getJob(response.jobId);
      setCurrentJob(job);
      setStep('processing');
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [selectedRetailer]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleBack = () => {
    if (step === 'upload') {
      setStep('select-retailer');
      setSelectedRetailer(null);
    } else if (step === 'processing') {
      // Confirm before canceling
      if (confirm('Are you sure you want to cancel? Progress will be saved.')) {
        setStep('upload');
      }
    } else {
      navigate(-1);
    }
  };

  const getProgressPercentage = () => {
    if (!currentJob?.progress) return 0;
    return currentJob.progress.percentComplete || 0;
  };

  // Helper to get result counts from progress
  const getResultCounts = () => {
    if (!currentJob?.progress) return { successCount: 0, reviewCount: 0, failedCount: 0, totalItems: 0 };
    return {
      successCount: currentJob.progress.autoAccepted || 0,
      reviewCount: currentJob.progress.needsReview || 0,
      failedCount: currentJob.progress.failed || 0,
      totalItems: currentJob.progress.totalLines || 0,
    };
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-neutral-900">
          {step === 'select-retailer' && 'Import from CSV'}
          {step === 'upload' && `Import from ${selectedRetailer ? RETAILERS.find(r => r.id === selectedRetailer)?.name : 'Retailer'}`}
          {step === 'processing' && 'Processing...'}
          {step === 'complete' && 'Import Complete!'}
        </h1>
      </div>

      {/* Step 1: Select Retailer */}
      {step === 'select-retailer' && (
        <div className="space-y-6">
          <p className="text-neutral-600">
            Choose where your order history is from. We'll help you get the best predictions.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RETAILERS.map((retailer) => (
              <Card
                key={retailer.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedRetailer === retailer.id && "ring-2 ring-blue-500"
                )}
                onClick={() => handleRetailerSelect(retailer.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-neutral-900">
                      {retailer.name}
                    </h3>
                    {retailer.badge && (
                      <span className={cn("text-xs px-2 py-1 rounded-full", retailer.badgeColor)}>
                        {retailer.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600">{retailer.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Alternative: Manual Entry */}
          <div className="border-t pt-6 mt-6">
            <p className="text-sm text-neutral-600 mb-4">
              Don't have order history? You can also add items manually.
            </p>
            <Button variant="outline" onClick={() => navigate('/onboarding/csv-wait')}>
              Add Items Manually
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Instructions Toggle */}
          {selectedRetailer === 'amazon' && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-4">
                <button 
                  className="flex items-center gap-2 text-blue-700 font-medium w-full text-left"
                  onClick={() => setShowInstructions(!showInstructions)}
                >
                  <HelpCircle className="h-5 w-5" />
                  How to get your Amazon CSV
                  <span className="ml-auto">{showInstructions ? '−' : '+'}</span>
                </button>
                
                {showInstructions && (
                  <div className="mt-4 space-y-2">
                    <ol className="list-decimal list-inside space-y-2 text-sm text-blue-900">
                      {AMAZON_INSTRUCTIONS.map((instruction, i) => (
                        <li key={i}>{instruction}</li>
                      ))}
                    </ol>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => window.open('https://www.amazon.com/gp/b2b/reports', '_blank')}
                    >
                      Open Amazon <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Drop Zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-12 text-center transition-all",
              isDragging ? "border-blue-500 bg-blue-50" : "border-neutral-300 bg-neutral-50",
              uploadError && "border-red-300 bg-red-50"
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                <p className="text-lg font-medium text-neutral-900">Uploading...</p>
              </div>
            ) : (
              <>
                <Upload className={cn("h-12 w-12 mx-auto mb-4", isDragging ? "text-blue-500" : "text-neutral-400")} />
                <p className="text-lg font-medium text-neutral-900 mb-2">
                  {isDragging ? 'Drop file here' : 'Drag and drop your file here'}
                </p>
                <p className="text-sm text-neutral-500 mb-4">
                  or
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <p className="text-xs text-neutral-500 mt-4">
                  Supported formats: .csv, .xlsx, .txt • Max size: 10 MB
                </p>
              </>
            )}
          </div>

          {uploadError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <XCircle className="h-5 w-5" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Processing */}
      {step === 'processing' && currentJob && (() => {
        const counts = getResultCounts();
        return (
        <div className="space-y-6">
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center gap-4 mb-6">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                <div>
                  <p className="font-medium text-neutral-900">
                    Processing your order history...
                  </p>
                  <p className="text-sm text-neutral-600">
                    This may take a minute or two
                  </p>
                </div>
              </div>

              <Progress value={getProgressPercentage()} className="mb-4" />
              
              <p className="text-sm text-neutral-600 mb-6">
                {getProgressPercentage()}% complete
                {counts.totalItems > 0 && ` (${counts.successCount + counts.reviewCount + counts.failedCount} of ${counts.totalItems} items)`}
              </p>

              {currentJob.progress && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>{counts.successCount} items auto-added</span>
                  </div>
                  {counts.reviewCount > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span>{counts.reviewCount} items need review</span>
                    </div>
                  )}
                  {counts.failedCount > 0 && (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span>{counts.failedCount} items failed</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Button variant="outline" onClick={handleBack}>
            Cancel Import
          </Button>
        </div>
        );
      })()}

      {/* Step 4: Complete */}
      {step === 'complete' && currentJob && (() => {
        const counts = getResultCounts();
        return (
        <div className="space-y-6">
          <Card className={cn(
            "border-2",
            currentJob.status === 'completed' ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          )}>
            <CardContent className="py-8 text-center">
              {currentJob.status === 'completed' ? (
                <>
                  <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                    Import Complete! 🎉
                  </h2>
                </>
              ) : (
                <>
                  <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                    Import Failed
                  </h2>
                  <p className="text-red-600">{currentJob.errorMessage}</p>
                </>
              )}
            </CardContent>
          </Card>

          {currentJob.status === 'completed' && currentJob.progress && (
            <>
              <Card>
                <CardContent className="py-6">
                  <h3 className="font-semibold text-neutral-900 mb-4">Summary</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span>Successfully added</span>
                      </div>
                      <span className="font-bold">{counts.successCount}</span>
                    </div>
                    {counts.reviewCount > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          <span>Need review</span>
                        </div>
                        <span className="font-bold">{counts.reviewCount}</span>
                      </div>
                    )}
                    {counts.failedCount > 0 && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span>Failed</span>
                        </div>
                        <span className="font-bold">{counts.failedCount}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-3">
                {counts.reviewCount > 0 && (
                  <Button 
                    onClick={() => {
                      // TODO: Open MicroReview modal
                      alert('MicroReview coming soon!');
                    }}
                    className="flex-1"
                  >
                    Review {counts.reviewCount} Items
                  </Button>
                )}
                <Button 
                  variant={counts.reviewCount > 0 ? "outline" : "default"}
                  onClick={() => navigate('/inventory')}
                  className="flex-1"
                >
                  View My Inventory
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setStep('select-retailer');
                    setSelectedRetailer(null);
                    setCurrentJob(null);
                  }}
                  className="flex-1"
                >
                  Import More
                </Button>
              </div>
            </>
          )}

          {currentJob.status === 'failed' && (
            <div className="flex gap-3">
              <Button onClick={() => {
                setStep('upload');
                setCurrentJob(null);
              }}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Go Home
              </Button>
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}
