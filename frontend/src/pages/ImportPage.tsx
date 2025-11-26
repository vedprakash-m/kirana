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
  Mail,
  Sparkles,
  Chrome,
  FileText,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { parsingApi } from '@/services/parsingApi';
import type { ParseJobResponse } from '@/services/parsingApi';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

type ImportStep = 'choose-method' | 'upload' | 'processing' | 'complete';
type ImportMethod = 'email' | 'manual' | 'csv' | 'extension';
type Retailer = 'amazon' | 'costco' | 'instacart' | 'other';

interface ImportMethodInfo {
  id: ImportMethod;
  name: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  available: boolean;
  comingSoon?: boolean;
}

const IMPORT_METHODS: ImportMethodInfo[] = [
  { 
    id: 'manual', 
    name: 'Teach Mode', 
    description: 'Add items as you shop - Kirana learns your patterns',
    icon: <Sparkles className="h-6 w-6" />,
    badge: '✨ Recommended',
    badgeColor: 'bg-blue-100 text-blue-800',
    available: true,
  },
  { 
    id: 'email', 
    name: 'Email Import', 
    description: 'Connect Gmail to automatically import order confirmations',
    icon: <Mail className="h-6 w-6" />,
    badge: '🚀 Coming Soon',
    badgeColor: 'bg-purple-100 text-purple-800',
    available: false,
    comingSoon: true,
  },
  { 
    id: 'extension', 
    name: 'Browser Extension', 
    description: 'One-click import from Amazon, Costco, Instacart',
    icon: <Chrome className="h-6 w-6" />,
    badge: '🚀 Coming Soon',
    badgeColor: 'bg-purple-100 text-purple-800',
    available: false,
    comingSoon: true,
  },
  { 
    id: 'csv', 
    name: 'Upload CSV', 
    description: 'For power users with exported order data',
    icon: <FileText className="h-6 w-6" />,
    available: true,
  },
];

interface RetailerInfo {
  id: Retailer;
  name: string;
  description: string;
  badge?: string;
  badgeColor?: string;
  helpText: string;
  exportUrl?: string;
}

const RETAILERS: RetailerInfo[] = [
  { 
    id: 'amazon', 
    name: 'Amazon', 
    description: 'Order history export via "Request Your Data"',
    badge: 'Complex',
    badgeColor: 'bg-yellow-100 text-yellow-800',
    helpText: 'Amazon requires you to request a data download that takes 1-3 days. The format is complex.',
    exportUrl: 'https://www.amazon.com/hz/privacy-central/data-requests/preview.html',
  },
  { 
    id: 'costco', 
    name: 'Costco', 
    description: 'No export available - use Teach Mode instead',
    badge: 'Not Available',
    badgeColor: 'bg-red-100 text-red-800',
    helpText: 'Costco doesn\'t provide order history export. We recommend using Teach Mode.',
  },
  { 
    id: 'instacart', 
    name: 'Instacart', 
    description: 'No export available - use Teach Mode instead',
    badge: 'Not Available',
    badgeColor: 'bg-red-100 text-red-800',
    helpText: 'Instacart doesn\'t provide order history export. We recommend using Teach Mode.',
  },
  { 
    id: 'other', 
    name: 'Other / Custom CSV', 
    description: 'Upload any CSV with item names and dates',
    helpText: 'Upload a CSV with columns: item_name, purchase_date, quantity (optional)',
  },
];

/**
 * ImportPage - Redesigned for realistic import options
 * 
 * Reality: Amazon, Costco, Instacart don't offer easy CSV export
 * Solution: Prioritize Teach Mode, with CSV as power-user option
 * Future: Email parsing, browser extension
 */
export function ImportPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>('choose-method');
  const [selectedMethod, setSelectedMethod] = useState<ImportMethod | null>(null);
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<ParseJobResponse | null>(null);

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

  const handleMethodSelect = (method: ImportMethod) => {
    if (!IMPORT_METHODS.find(m => m.id === method)?.available) {
      return; // Can't select unavailable methods
    }
    
    setSelectedMethod(method);
    
    if (method === 'manual') {
      // Go to Teach Mode / manual entry
      navigate('/inventory');
    } else if (method === 'csv') {
      // Show retailer selection for CSV
      setStep('upload');
    }
  };

  const handleRetailerSelect = (retailer: Retailer) => {
    setSelectedRetailer(retailer);
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
      setStep('choose-method');
      setSelectedMethod(null);
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
          {step === 'choose-method' && 'Import Your Shopping Data'}
          {step === 'upload' && 'Upload CSV File'}
          {step === 'processing' && 'Processing...'}
          {step === 'complete' && 'Import Complete!'}
        </h1>
      </div>

      {/* Step 1: Choose Import Method */}
      {step === 'choose-method' && (
        <div className="space-y-6">
          <p className="text-neutral-600">
            Choose how you'd like to get started. Kirana works best when it learns from your actual shopping habits.
          </p>

          <div className="space-y-4">
            {IMPORT_METHODS.map((method) => (
              <Card
                key={method.id}
                className={cn(
                  "transition-all",
                  method.available 
                    ? "cursor-pointer hover:shadow-md hover:border-blue-300" 
                    : "opacity-60 cursor-not-allowed",
                  selectedMethod === method.id && "ring-2 ring-blue-500"
                )}
                onClick={() => handleMethodSelect(method.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-lg",
                      method.available ? "bg-blue-100 text-blue-600" : "bg-neutral-100 text-neutral-400"
                    )}>
                      {method.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-semibold text-neutral-900">
                          {method.name}
                        </h3>
                        {method.badge && (
                          <span className={cn("text-xs px-2 py-1 rounded-full", method.badgeColor)}>
                            {method.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600">{method.description}</p>
                      
                      {method.id === 'manual' && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                          <Clock className="h-4 w-4" />
                          <span>Takes ~2 min to add your first items</span>
                        </div>
                      )}
                      
                      {method.comingSoon && (
                        <div className="mt-3 text-sm text-purple-600">
                          Sign up to be notified when this is ready
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Why Teach Mode Works Best */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="py-6">
              <h3 className="font-semibold text-neutral-900 mb-2 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Why We Recommend Teach Mode
              </h3>
              <ul className="space-y-2 text-sm text-neutral-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span><strong>Works with any store</strong> - not limited to retailers with export options</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span><strong>Learns as you go</strong> - predictions improve with each purchase</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <span><strong>No data export needed</strong> - Amazon & Costco don't easily export order history</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: CSV Upload with Retailer Selection */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Retailer Selection */}
          {!selectedRetailer && (
            <>
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <strong>Note:</strong> Most retailers don't provide easy CSV export. 
                      Check below for available options, or consider using <button 
                        className="underline font-medium" 
                        onClick={() => navigate('/inventory')}
                      >Teach Mode</button> instead.
                    </div>
                  </div>
                </CardContent>
              </Card>

              <p className="text-neutral-600">
                Select your retailer to see export options:
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
                    <CardContent className="p-5">
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
            </>
          )}

          {/* Retailer-Specific Instructions */}
          {selectedRetailer && (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedRetailer(null)}
                className="mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Choose different retailer
              </Button>

              {(selectedRetailer === 'costco' || selectedRetailer === 'instacart') && (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="py-6 text-center">
                    <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                      {RETAILERS.find(r => r.id === selectedRetailer)?.name} doesn't support export
                    </h3>
                    <p className="text-sm text-neutral-600 mb-4">
                      Unfortunately, this retailer doesn't provide order history export functionality.
                    </p>
                    <Button onClick={() => navigate('/inventory')}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Use Teach Mode Instead
                    </Button>
                  </CardContent>
                </Card>
              )}

              {selectedRetailer === 'amazon' && (
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="py-6">
                    <h3 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      Amazon Export is Complex
                    </h3>
                    <p className="text-sm text-neutral-700 mb-4">
                      Amazon's "Request Your Data" feature takes 1-3 days and produces files in a complex format.
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-700 mb-4">
                      <li>Go to Amazon Privacy Central</li>
                      <li>Click "Request Your Data"</li>
                      <li>Select "Your Orders" category</li>
                      <li>Wait 1-3 days for email</li>
                      <li>Download and extract the ZIP file</li>
                      <li>Find the orders CSV file inside</li>
                    </ol>
                    <div className="flex flex-wrap gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => window.open('https://www.amazon.com/hz/privacy-central/data-requests/preview.html', '_blank')}
                      >
                        Open Amazon Privacy <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                      <Button onClick={() => navigate('/inventory')}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Skip - Use Teach Mode
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(selectedRetailer === 'amazon' || selectedRetailer === 'other') && (
                <>
                  <div className="text-center text-sm text-neutral-500 my-4">
                    {selectedRetailer === 'amazon' ? 'Already have your Amazon data?' : 'Ready to upload?'}
                  </div>

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

                  {selectedRetailer === 'other' && (
                    <Card className="bg-neutral-50">
                      <CardContent className="py-4">
                        <h4 className="font-medium text-neutral-900 mb-2">Expected CSV Format</h4>
                        <p className="text-sm text-neutral-600 mb-2">
                          Your CSV should include these columns (names can vary):
                        </p>
                        <div className="bg-white rounded border p-3 font-mono text-xs overflow-x-auto">
                          <div className="text-neutral-500">item_name, purchase_date, quantity, price</div>
                          <div>Milk 2%, 2024-01-15, 2, 4.99</div>
                          <div>Bread Whole Wheat, 2024-01-15, 1, 3.49</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
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
                    setStep('choose-method');
                    setSelectedMethod(null);
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
