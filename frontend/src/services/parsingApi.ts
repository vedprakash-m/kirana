/**
 * Parsing API Service
 * 
 * Handles CSV upload, parse job polling, and micro-review submissions.
 * Implements the 3-tier parsing strategy with smart merge logic.
 * 
 * Features:
 * - CSV upload with multipart/form-data
 * - Parse job polling with progress tracking
 * - Micro-review submission (accept/edit/reject)
 * - Rate limiting: 120 requests/minute for polling
 * 
 * Tech Spec Reference: Section 6.2 - Parsing Service
 * PRD Reference: Section 3.2 - Data Ingestion
 */

import { apiClient } from './api';

/**
 * Supported retailers for CSV parsing
 */
export type Retailer = 'amazon' | 'costco' | 'instacart' | 'other';

/**
 * Parse job status values
 */
export type ParseJobStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'needs_review'
  | 'queued';

/**
 * Progress metrics during parsing
 */
export interface ParseProgress {
  totalLines: number;
  parsed: number;
  autoAccepted: number;
  needsReview: number;
  failed: number;
  percentComplete: number;
}

/**
 * Parsed item structure (matches backend ParsedItem)
 */
export interface ParsedItem {
  id: string;
  rawText: string;
  canonicalName?: string;
  brand?: string;
  category?: string;
  quantity?: number;
  unitOfMeasure?: string;
  packageSize?: number;
  packageUnit?: string;
  price?: number;
  vendor?: string;
  purchaseDate?: string;
  confidence: number;
  needsReview: boolean;
  userReviewed: boolean;
  isDuplicate: boolean;
  duplicateItemId?: string;
  reviewReason?: string;
}

/**
 * Parse job response from API
 */
export interface ParseJobResponse {
  jobId: string;
  status: ParseJobStatus;
  progress: ParseProgress;
  results?: ParsedItem[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Upload CSV response
 */
export interface UploadCSVResponse {
  jobId: string;
  status: ParseJobStatus;
  message: string;
}

/**
 * Micro-review action types
 */
export type ReviewAction = 'accept' | 'edit' | 'reject';

/**
 * Corrections for edited items
 */
export interface ItemCorrections {
  canonicalName?: string;
  brand?: string;
  category?: string;
  quantity?: number;
  unitOfMeasure?: string;
  price?: number;
}

/**
 * Review submission response
 */
export interface ReviewSubmissionResponse {
  success: boolean;
  itemId?: string;
  transactionId?: string;
  merged: boolean;
  mergeReason?: string;
  remainingReviews: number;
}

class ParsingApiService {
  /**
   * Upload a CSV file for parsing
   * 
   * @param file - CSV file to upload
   * @param retailer - Source retailer (amazon, costco, instacart, other)
   * @returns Parse job with jobId for polling
   */
  async uploadCSV(file: File, retailer: Retailer): Promise<UploadCSVResponse> {
    // Validate file
    if (!file.name.toLowerCase().endsWith('.csv')) {
      throw new Error('Only CSV files are supported');
    }
    
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size must be less than 5MB');
    }

    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('retailer', retailer);

    // Upload with FormData helper
    return apiClient.postFormData<UploadCSVResponse>('/parsing/csv', formData);
  }

  /**
   * Get parse job status and progress
   * 
   * @param jobId - Parse job ID from uploadCSV
   * @returns Parse job with progress and results
   */
  async getJob(jobId: string): Promise<ParseJobResponse> {
    return apiClient.get<ParseJobResponse>(`/parsing/parseJobs/${jobId}`);
  }

  /**
   * List recent parse jobs for the household
   * 
   * @returns Array of parse jobs (most recent first, max 50)
   */
  async listJobs(): Promise<ParseJobResponse[]> {
    return apiClient.get<ParseJobResponse[]>('/parsing/parseJobs');
  }

  /**
   * Submit a micro-review decision for a parsed item
   * 
   * @param jobId - Parse job ID
   * @param itemId - Parsed item ID within the job
   * @param action - accept, edit, or reject
   * @param corrections - Item corrections (required for 'edit' action)
   * @returns Review result with item/transaction IDs if created
   */
  async submitReview(
    jobId: string,
    itemId: string,
    action: ReviewAction,
    corrections?: ItemCorrections
  ): Promise<ReviewSubmissionResponse> {
    return apiClient.post<ReviewSubmissionResponse>('/parsing/submitReview', {
      jobId,
      itemId,
      action,
      corrections,
    });
  }

  /**
   * Poll for job completion with automatic retry
   * 
   * @param jobId - Parse job ID
   * @param onProgress - Callback for progress updates
   * @param pollInterval - Polling interval in ms (default: 1000)
   * @param maxAttempts - Maximum polling attempts (default: 300 = 5 minutes)
   * @returns Final job state when complete or failed
   */
  async pollUntilComplete(
    jobId: string,
    onProgress?: (job: ParseJobResponse) => void,
    pollInterval: number = 1000,
    maxAttempts: number = 300
  ): Promise<ParseJobResponse> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const job = await this.getJob(jobId);
      
      if (onProgress) {
        onProgress(job);
      }

      // Terminal states
      if (
        job.status === 'completed' ||
        job.status === 'failed' ||
        job.status === 'needs_review'
      ) {
        return job;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error('Polling timeout: Parse job did not complete in time');
  }

  /**
   * Get items that need review from a parse job
   * 
   * @param job - Parse job response
   * @returns Items with needsReview = true
   */
  getItemsNeedingReview(job: ParseJobResponse): ParsedItem[] {
    return (job.results || []).filter(item => item.needsReview && !item.userReviewed);
  }

  /**
   * Get auto-accepted items from a parse job
   * 
   * @param job - Parse job response
   * @returns Items with needsReview = false
   */
  getAutoAcceptedItems(job: ParseJobResponse): ParsedItem[] {
    return (job.results || []).filter(item => !item.needsReview);
  }
}

export const parsingApi = new ParsingApiService();
