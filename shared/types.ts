/**
 * Kirana Shared TypeScript Types
 * 
 * This file contains all domain models, DTOs, and interfaces used across
 * frontend and backend. All dates use ISO 8601 format.
 * 
 * Symlinked to:
 * - frontend/src/types/shared.ts
 * - backend/src/types/shared.ts
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum UnitOfMeasure {
  // Volume
  FLUID_OUNCES = 'fl oz',
  MILLILITERS = 'ml',
  LITERS = 'L',
  GALLONS = 'gal',
  CUPS = 'cup',
  TABLESPOONS = 'tbsp',
  TEASPOONS = 'tsp',
  
  // Weight
  OUNCES = 'oz',
  POUNDS = 'lb',
  GRAMS = 'g',
  KILOGRAMS = 'kg',
  
  // Count
  EACH = 'each',
  PACK = 'pack',
  DOZEN = 'dozen',
  BOX = 'box',
  BAG = 'bag',
  BOTTLE = 'bottle',
  CAN = 'can',
  JAR = 'jar',
  CARTON = 'carton',
  CONTAINER = 'container',
  
  // Other
  OTHER = 'other'
}

export enum Category {
  DAIRY = 'Dairy & Eggs',
  PRODUCE = 'Produce',
  MEAT_SEAFOOD = 'Meat & Seafood',
  BAKERY = 'Bakery',
  PANTRY = 'Pantry Staples',
  BEVERAGES = 'Beverages',
  SNACKS = 'Snacks',
  FROZEN = 'Frozen Foods',
  HOUSEHOLD = 'Household Supplies',
  PERSONAL_CARE = 'Personal Care',
  PET_SUPPLIES = 'Pet Supplies',
  BABY = 'Baby Products',
  OTHER = 'Other'
}

export enum Vendor {
  AMAZON = 'Amazon',
  COSTCO = 'Costco',
  WALMART = 'Walmart',
  TARGET = 'Target',
  WHOLE_FOODS = 'Whole Foods',
  TRADER_JOES = 'Trader Joe\'s',
  SAFEWAY = 'Safeway',
  KROGER = 'Kroger',
  INSTACART = 'Instacart',
  LOCAL_STORE = 'Local Store',
  OTHER = 'Other'
}

export enum PredictionConfidence {
  HIGH = 'High',      // ≥3 purchases, stdDev <20%, recent purchase <30 days
  MEDIUM = 'Medium',  // ≥2 purchases OR relaxed thresholds
  LOW = 'Low',        // <2 purchases OR teach mode only
  NONE = 'None'       // No data or prediction disabled
}

export enum IngestionSource {
  MANUAL = 'manual',
  CSV_AMAZON = 'csv_amazon',
  CSV_INSTACART = 'csv_instacart',
  CSV_COSTCO = 'csv_costco',
  PHOTO_OCR = 'photo_ocr',
  EMAIL_FORWARD = 'email_forward',
  TEACH_MODE = 'teach_mode',
  DEMO = 'demo'
}

export enum ParseJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  NEEDS_REVIEW = 'needs_review',
  QUEUED = 'queued'  // Budget exceeded, queued for batch processing
}

export enum HouseholdRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer'
}

export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  SYNCING = 'syncing',
  CONFLICT = 'conflict',
  ERROR = 'error'
}

export enum ErrorCode {
  // Authentication
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  
  // Authorization
  FORBIDDEN = 'FORBIDDEN',
  HOUSEHOLD_ACCESS_DENIED = 'HOUSEHOLD_ACCESS_DENIED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_ITEM = 'DUPLICATE_ITEM',
  INVALID_DATE = 'INVALID_DATE',
  INVALID_QUANTITY = 'INVALID_QUANTITY',
  
  // LLM & Parsing
  LLM_QUOTA_EXCEEDED = 'LLM_QUOTA_EXCEEDED',
  LLM_COST_EXCEEDED = 'LLM_COST_EXCEEDED',
  PARSING_FAILED = 'PARSING_FAILED',
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  
  // Database
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // External Services
  BLOB_STORAGE_ERROR = 'BLOB_STORAGE_ERROR',
  GEMINI_API_ERROR = 'GEMINI_API_ERROR',
  
  // Generic
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

// ============================================================================
// CORE DOMAIN MODELS
// ============================================================================

/**
 * Price history entry for an item
 */
export interface PriceEntry {
  date: string;  // ISO 8601
  price: number;
  vendor: Vendor;
  quantity: number;
  unitOfMeasure: UnitOfMeasure;
}

/**
 * User override for prediction
 */
export interface UserOverride {
  date: string;  // ISO 8601 when override was made
  predictedRunOutDate: string;  // ISO 8601
  reason?: string;
  userId: string;
}

/**
 * Main inventory item (Aggregate Root)
 */
export interface Item {
  id: string;  // uuid-v4
  householdId: string;
  
  // Identity
  canonicalName: string;  // Normalized name (e.g., "Milk, Organic, Whole")
  brand?: string;
  category: Category;
  
  // Physical Properties
  quantity: number;  // Current quantity
  unitOfMeasure: UnitOfMeasure;
  packageSize: number;  // Size per unit (e.g., 64 for 64 fl oz)
  packageUnit: UnitOfMeasure;
  
  // Purchase Info
  preferredVendor?: Vendor;
  lastPurchaseDate?: string;  // ISO 8601
  lastPurchasePrice?: number;
  priceHistory: PriceEntry[];  // Max 12 entries (rolling 12 months)
  
  // Predictions
  predictedRunOutDate?: string;  // ISO 8601
  predictionConfidence: PredictionConfidence;
  avgFrequencyDays?: number;  // Average days between purchases
  avgConsumptionRate?: number;  // Units consumed per day
  
  // User Preferences
  userOverrides: UserOverride[];
  teachModeEnabled: boolean;  // If true, use teach mode frequency
  teachModeFrequencyDays?: number;  // User-set frequency (for teach mode)
  
  // Metadata
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  createdBy: string;  // userId
  deletedAt?: string;  // ISO 8601 (soft delete)
  
  // Cosmos DB
  _etag?: string;  // Optimistic concurrency control
}

/**
 * Purchase transaction (Value Object)
 */
export interface Transaction {
  id: string;  // uuid-v4
  householdId: string;
  itemId: string;
  
  // Purchase Details
  purchaseDate: string;  // ISO 8601
  quantity: number;
  totalPrice: number;
  unitPrice: number;
  vendor: Vendor;
  
  // Source Metadata
  source: IngestionSource;
  sourceMetadata: {
    receiptId?: string;
    orderId?: string;
    lineItemNumber?: number;
    rawText?: string;
    confidence?: number;
  };
  
  // Metadata
  createdAt: string;  // ISO 8601
  createdBy: string;  // userId
  
  // Cosmos DB
  _etag?: string;
}

/**
 * Household (for multi-user support)
 */
export interface Household {
  id: string;
  name: string;
  
  // Members
  members: HouseholdMember[];
  
  // Settings
  settings: {
    timezone: string;  // IANA timezone (e.g., "America/Los_Angeles")
    currency: string;  // ISO 4217 (e.g., "USD")
    defaultVendor?: Vendor;
    syncInterval: number;  // Minutes between syncs (5-15)
  };
  
  // Metadata
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  
  // Cosmos DB
  _etag?: string;
}

/**
 * Household member
 */
export interface HouseholdMember {
  userId: string;
  email: string;
  displayName: string;
  role: HouseholdRole;
  joinedAt: string;  // ISO 8601
  invitedBy?: string;  // userId
}

/**
 * User profile
 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  
  // Auth
  entraId: string;  // Microsoft Entra ID
  
  // Household
  householdId: string;
  
  // Preferences
  preferences: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    weeklyDigest: boolean;
  };
  
  // Metadata
  createdAt: string;  // ISO 8601
  lastLoginAt: string;  // ISO 8601
  
  // Cosmos DB
  _etag?: string;
}

// ============================================================================
// LLM & PARSING
// ============================================================================

/**
 * LLM normalization cache entry
 */
export interface CacheEntry {
  id: string;  // hash of rawText + context
  householdId: string;
  
  // Input
  rawText: string;
  context?: string;  // Additional context (e.g., vendor, category hint)
  
  // Output
  normalizedItem: {
    canonicalName: string;
    brand?: string;
    category: Category;
    quantity: number;
    unitOfMeasure: UnitOfMeasure;
    packageSize: number;
    packageUnit: UnitOfMeasure;
    confidence: number;  // 0-1
  };
  
  // Metadata
  hitCount: number;
  createdAt: string;  // ISO 8601
  lastAccessedAt: string;  // ISO 8601
  
  // Cosmos DB
  ttl?: number;  // Seconds (90 days = 7776000)
  _etag?: string;
}

/**
 * Parse job for async processing
 */
export interface ParseJob {
  id: string;  // uuid-v4
  householdId: string;
  userId: string;
  
  // Job Details
  status: ParseJobStatus;
  source: IngestionSource;
  blobUrl?: string;  // Azure Blob Storage URL
  rawData?: string;  // CSV text or JSON
  
  // Results
  results: ParsedItem[];
  errorMessage?: string;
  
  // Metadata
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  completedAt?: string;  // ISO 8601
  
  // Cosmos DB
  ttl?: number;  // 7 days = 604800
  _etag?: string;
}

/**
 * Parsed item from receipt/CSV (before normalization)
 */
export interface ParsedItem {
  rawText: string;
  
  // Parsed Fields
  canonicalName?: string;
  brand?: string;
  category?: Category;
  quantity?: number;
  unitOfMeasure?: UnitOfMeasure;
  packageSize?: number;
  packageUnit?: UnitOfMeasure;
  price?: number;
  vendor?: Vendor;
  purchaseDate?: string;  // ISO 8601
  
  // Confidence & Review
  confidence: number;  // 0-1
  needsReview: boolean;  // true if confidence < 0.8
  userReviewed: boolean;
  
  // Duplicate Detection
  isDuplicate: boolean;
  duplicateItemId?: string;
}

/**
 * Cost tracking entry
 */
export interface CostTracking {
  id: string;  // format: {householdId}_{userId}_{period}
  householdId: string;
  userId?: string;  // If null, system-wide tracking
  
  // Period
  period: string;  // YYYY-MM for monthly, YYYY-MM-DD for daily
  periodType: 'daily' | 'monthly';
  
  // Costs
  llmCalls: number;
  llmTokensIn: number;
  llmTokensOut: number;
  llmCostUSD: number;
  
  // Metadata
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  
  // Cosmos DB
  _etag?: string;
}

// ============================================================================
// ANALYTICS & EVENTS
// ============================================================================

/**
 * Analytics event
 */
export interface AnalyticsEvent {
  id: string;  // uuid-v4
  householdId: string;
  userId: string;
  
  // Event
  eventType: string;  // e.g., "item_created", "prediction_calculated", "csv_uploaded"
  eventData: Record<string, any>;
  
  // Context
  sessionId?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  userAgent?: string;
  
  // Metadata
  timestamp: string;  // ISO 8601
  
  // Cosmos DB
  ttl?: number;  // 90 days = 7776000
  _etag?: string;
}

// ============================================================================
// API DTOs (Request/Response)
// ============================================================================

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: {
    timestamp: string;
    requestId: string;
  };
}

/**
 * API Error
 */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: any;
  field?: string;  // For validation errors
}

/**
 * Validation Error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: ErrorCode;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Create Item DTO
 */
export interface CreateItemDto {
  canonicalName: string;
  brand?: string;
  category: Category;
  quantity: number;
  unitOfMeasure: UnitOfMeasure;
  packageSize: number;
  packageUnit: UnitOfMeasure;
  preferredVendor?: Vendor;
  teachModeEnabled?: boolean;
  teachModeFrequencyDays?: number;
}

/**
 * Update Item DTO
 */
export interface UpdateItemDto {
  canonicalName?: string;
  brand?: string;
  category?: Category;
  quantity?: number;
  unitOfMeasure?: UnitOfMeasure;
  packageSize?: number;
  packageUnit?: UnitOfMeasure;
  preferredVendor?: Vendor;
  lastPurchaseDate?: string;
  lastPurchasePrice?: number;
  teachModeEnabled?: boolean;
  teachModeFrequencyDays?: number;
}

/**
 * Create Transaction DTO
 */
export interface CreateTransactionDto {
  itemId: string;
  purchaseDate: string;  // ISO 8601
  quantity: number;
  totalPrice: number;
  vendor: Vendor;
  source: IngestionSource;
  sourceMetadata?: {
    receiptId?: string;
    orderId?: string;
    lineItemNumber?: number;
    rawText?: string;
    confidence?: number;
    restockAction?: boolean;
    [key: string]: any;  // Allow additional metadata
  };
}

/**
 * Parse CSV Request
 */
export interface ParseCsvRequest {
  csvData: string;  // Raw CSV text
  vendor: Vendor;
  source: IngestionSource;
}

/**
 * Parse Photo Request
 */
export interface ParsePhotoRequest {
  imageData: string;  // Base64 encoded image
  vendor?: Vendor;
}

/**
 * Calculate Prediction Request
 */
export interface CalculatePredictionRequest {
  itemId: string;
  forceRecalculate?: boolean;
}

/**
 * Override Prediction Request
 */
export interface OverridePredictionRequest {
  itemId: string;
  predictedRunOutDate: string;  // ISO 8601
  reason?: string;
}

/**
 * One-Tap Restock DTO
 */
export interface OneTapRestockDto {
  itemId: string;
  quantity?: number;  // If not provided, use last purchase quantity
  vendor?: Vendor;    // If not provided, use preferred vendor
}

// ============================================================================
// SYNC & OFFLINE
// ============================================================================

/**
 * Sync state for multi-device support
 */
export interface SyncState {
  id: string;  // {householdId}_{deviceId}
  householdId: string;
  deviceId: string;
  userId: string;
  
  // Sync Info
  lastSyncAt: string;  // ISO 8601
  lastChangeToken: string;  // Cosmos DB continuation token
  syncStatus: SyncStatus;
  
  // Conflict Resolution
  conflictingChanges?: ConflictingChange[];
  
  // Metadata
  updatedAt: string;  // ISO 8601
  
  // Cosmos DB
  _etag?: string;
}

/**
 * Conflicting change (for multi-device sync)
 */
export interface ConflictingChange {
  entityType: 'item' | 'transaction' | 'household';
  entityId: string;
  localVersion: any;
  remoteVersion: any;
  timestamp: string;  // ISO 8601
}

/**
 * Offline queue item
 */
export interface OfflineQueueItem {
  id: string;  // uuid-v4
  action: 'create' | 'update' | 'delete';
  entityType: 'item' | 'transaction';
  entityId: string;
  payload: any;
  createdAt: string;  // ISO 8601
  retryCount: number;
  lastError?: string;
}

// ============================================================================
// FRONTEND-SPECIFIC TYPES
// ============================================================================

/**
 * Frontend store state for items
 */
export interface ItemsState {
  items: Item[];
  selectedItem: Item | null;
  loading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  lastSyncAt: string | null;
}

/**
 * Frontend store state for transactions
 */
export interface TransactionsState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
}

/**
 * Frontend store state for auth
 */
export interface AuthState {
  user: User | null;
  household: Household | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Frontend store state for parsing
 */
export interface ParsingState {
  activeJob: ParseJob | null;
  pendingReviews: ParsedItem[];
  loading: boolean;
  error: string | null;
}

/**
 * UI urgency level (for color coding)
 */
export enum UrgencyLevel {
  CRITICAL = 'critical',  // Red
  WARNING = 'warning',    // Yellow
  HEALTHY = 'healthy',    // Green
  UNKNOWN = 'unknown'     // Gray
}

/**
 * UI urgency info
 */
export interface UrgencyInfo {
  level: UrgencyLevel;
  daysRemaining: number;
  urgencyRatio: number;  // daysRemaining / avgFrequencyDays
  color: string;
  label: string;  // e.g., "Critical · 14% of cycle left"
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Type guard: Check if error is ApiError
 */
export function isApiError(error: any): error is ApiError {
  return error && typeof error.code === 'string' && typeof error.message === 'string';
}

/**
 * Type guard: Check if item has high confidence prediction
 */
export function hasHighConfidencePrediction(item: Item): boolean {
  return item.predictionConfidence === PredictionConfidence.HIGH;
}

/**
 * Type guard: Check if item is running out soon (≤7 days)
 */
export function isRunningOutSoon(item: Item): boolean {
  if (!item.predictedRunOutDate) return false;
  const runOutDate = new Date(item.predictedRunOutDate);
  const now = new Date();
  const daysRemaining = (runOutDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysRemaining <= 7;
}

/**
 * Type guard: Check if parse job needs review
 */
export function parseJobNeedsReview(job: ParseJob): boolean {
  return job.status === ParseJobStatus.NEEDS_REVIEW || 
         job.results.some(item => item.needsReview && !item.userReviewed);
}

/**
 * Extract file extension from blob URL
 */
export type FileExtension = 'csv' | 'jpg' | 'png' | 'pdf' | 'html';

/**
 * Demo mode item (for onboarding)
 */
export interface DemoItem extends Omit<Item, 'householdId' | 'createdBy'> {
  isDemo: true;
}
