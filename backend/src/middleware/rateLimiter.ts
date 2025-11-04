/**
 * Rate Limiting Middleware
 * 
 * Provides configurable rate limiting for Azure Functions with sliding window algorithm.
 * 
 * Per-Endpoint Limits (PRD Section 10 - Cost Controls):
 * - CSV Upload: 5 requests/minute per user
 * - Photo OCR: 10 requests/minute per user
 * - Micro-Review: 30 requests/minute per user
 * - Parse Job Polling: 120 requests/minute per user (2/second)
 * 
 * Implementation:
 * - In-memory sliding window (suitable for single-instance Azure Functions)
 * - Returns 429 with Retry-After header when limit exceeded
 * - Includes X-RateLimit-* headers for client visibility
 * - Cleanup mechanism to prevent memory leaks
 * 
 * Production Enhancement:
 * - For multi-instance deployments, migrate to Redis/Cosmos DB for distributed rate limiting
 * - Current implementation is sufficient for MVP with expected < 1000 concurrent users
 */

import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { ErrorCode, ApiResponse } from '../types/shared';

/**
 * Rate limit configuration for an endpoint
 */
export interface RateLimitConfig {
  maxRequests: number;    // Maximum requests allowed in window
  windowMs: number;        // Time window in milliseconds
  keyGenerator?: (req: HttpRequest) => string;  // Custom key generator (default: userId from query/header)
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  CSV_UPLOAD: { maxRequests: 5, windowMs: 60000 },      // 5/minute
  PHOTO_OCR: { maxRequests: 10, windowMs: 60000 },      // 10/minute
  MICRO_REVIEW: { maxRequests: 30, windowMs: 60000 },   // 30/minute
  PARSE_POLLING: { maxRequests: 120, windowMs: 60000 }, // 120/minute (2/second)
  DEFAULT: { maxRequests: 60, windowMs: 60000 }         // 60/minute default
} as const;

/**
 * Rate limiter class with sliding window algorithm
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly config: RateLimitConfig;
  
  constructor(config: RateLimitConfig) {
    this.config = config;
  }
  
  /**
   * Check if request is allowed
   * Returns { allowed: boolean, retryAfter?: number, remaining: number }
   */
  check(key: string): { 
    allowed: boolean; 
    retryAfter?: number; 
    remaining: number;
    resetAt: number;
  } {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    
    // Remove expired requests (outside window)
    const validRequests = userRequests.filter(timestamp => 
      now - timestamp < this.config.windowMs
    );
    
    const remaining = Math.max(0, this.config.maxRequests - validRequests.length);
    
    if (validRequests.length >= this.config.maxRequests) {
      // Rate limit exceeded
      const oldestRequest = Math.min(...validRequests);
      const resetAt = oldestRequest + this.config.windowMs;
      const retryAfter = Math.ceil((resetAt - now) / 1000);
      
      return { 
        allowed: false, 
        retryAfter, 
        remaining: 0,
        resetAt
      };
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    // Cleanup old entries periodically
    if (this.requests.size > 10000) {
      this.cleanup();
    }
    
    return { 
      allowed: true, 
      remaining: remaining - 1, // Account for current request
      resetAt: now + this.config.windowMs
    };
  }
  
  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, timestamps] of this.requests.entries()) {
      const validRequests = timestamps.filter(ts => now - ts < this.config.windowMs);
      if (validRequests.length === 0) {
        keysToDelete.push(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
    
    keysToDelete.forEach(key => this.requests.delete(key));
  }
  
  /**
   * Get current request count for a key
   */
  getRequestCount(key: string): number {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    return userRequests.filter(timestamp => now - timestamp < this.config.windowMs).length;
  }
  
  /**
   * Reset rate limit for a key (useful for testing)
   */
  reset(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
}

/**
 * Rate limiter instances (singleton per endpoint type)
 */
const rateLimiters = new Map<string, RateLimiter>();

/**
 * Get or create rate limiter for endpoint
 */
function getRateLimiter(name: string, config: RateLimitConfig): RateLimiter {
  if (!rateLimiters.has(name)) {
    rateLimiters.set(name, new RateLimiter(config));
  }
  return rateLimiters.get(name)!;
}

/**
 * Default key generator: Extract userId from query params or x-user-id header
 */
function defaultKeyGenerator(req: HttpRequest): string {
  const userId = req.query.get('userId') || req.headers.get('x-user-id');
  if (!userId) {
    throw new Error('Missing userId in query params or x-user-id header');
  }
  return userId;
}

/**
 * Rate limiting middleware
 * 
 * Usage:
 * ```typescript
 * import { rateLimitMiddleware, RATE_LIMITS } from '../middleware/rateLimiter';
 * 
 * export async function httpTrigger(
 *   req: HttpRequest,
 *   context: InvocationContext
 * ): Promise<HttpResponseInit> {
 *   // Apply rate limiting
 *   const rateLimitResult = rateLimitMiddleware(req, RATE_LIMITS.CSV_UPLOAD);
 *   if (rateLimitResult) {
 *     return rateLimitResult; // Return 429 response
 *   }
 *   
 *   // ... rest of function logic
 * }
 * ```
 * 
 * @param req - Azure Functions HTTP request
 * @param config - Rate limit configuration
 * @param endpointName - Unique name for this endpoint (default: function name)
 * @returns HttpResponseInit with 429 status if rate limit exceeded, null otherwise
 */
export function rateLimitMiddleware(
  req: HttpRequest,
  config: RateLimitConfig,
  endpointName?: string
): HttpResponseInit | null {
  try {
    // Get rate limiter instance
    const name = endpointName || req.url.split('/').slice(-2).join('/');
    const limiter = getRateLimiter(name, config);
    
    // Generate rate limit key
    const keyGenerator = config.keyGenerator || defaultKeyGenerator;
    const key = keyGenerator(req);
    
    // Check rate limit
    const result = limiter.check(key);
    
    if (!result.allowed) {
      // Rate limit exceeded - return 429
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: ErrorCode.RATE_LIMIT_EXCEEDED,
          message: `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs / 1000} seconds.`,
          details: {
            maxRequests: config.maxRequests,
            windowSeconds: config.windowMs / 1000,
            retryAfter: result.retryAfter
          }
        }
      };
      
      return {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': result.retryAfter!.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(result.resetAt).toISOString()
        },
        jsonBody: response
      };
    }
    
    // Rate limit not exceeded - add headers and continue
    // Note: Headers will need to be added to the final response by the caller
    (req as any).rateLimitHeaders = {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.resetAt).toISOString()
    };
    
    return null; // Continue to handler
  } catch (error: any) {
    // Missing userId or other error - return 400
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: error.message || 'Rate limiting error: Missing userId parameter',
        details: { field: 'userId' }
      }
    };
    
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: response
    };
  }
}

/**
 * Helper to add rate limit headers to response
 * 
 * Usage:
 * ```typescript
 * const response: HttpResponseInit = {
 *   status: 200,
 *   jsonBody: data
 * };
 * addRateLimitHeaders(response, req);
 * return response;
 * ```
 */
export function addRateLimitHeaders(
  response: HttpResponseInit,
  req: HttpRequest
): void {
  const headers = (req as any).rateLimitHeaders;
  if (headers) {
    response.headers = {
      ...response.headers,
      ...headers
    };
  }
}

/**
 * Backoff policy for clients
 * 
 * When receiving 429 responses:
 * 1. Read Retry-After header (in seconds)
 * 2. Wait for specified duration before retrying
 * 3. Implement exponential backoff if Retry-After not provided:
 *    - 1st retry: 1 second
 *    - 2nd retry: 2 seconds
 *    - 3rd retry: 4 seconds
 *    - Max: 60 seconds
 * 4. After 5 consecutive 429s, show user error and stop retrying
 * 
 * Example client code:
 * ```typescript
 * async function retryWithBackoff<T>(
 *   fn: () => Promise<T>,
 *   maxRetries: number = 5
 * ): Promise<T> {
 *   let retries = 0;
 *   
 *   while (true) {
 *     try {
 *       return await fn();
 *     } catch (error: any) {
 *       if (error.status === 429 && retries < maxRetries) {
 *         const retryAfter = parseInt(error.headers.get('Retry-After') || '0');
 *         const backoff = retryAfter > 0 
 *           ? retryAfter * 1000 
 *           : Math.min(1000 * Math.pow(2, retries), 60000);
 *         
 *         await new Promise(resolve => setTimeout(resolve, backoff));
 *         retries++;
 *       } else {
 *         throw error;
 *       }
 *     }
 *   }
 * }
 * ```
 */
export const CLIENT_BACKOFF_POLICY = {
  maxRetries: 5,
  maxBackoffMs: 60000,
  exponentialBase: 2
};

/**
 * Get rate limiter stats (for monitoring/debugging)
 */
export function getRateLimiterStats(): Record<string, { 
  activeKeys: number;
  totalRequests: number;
}> {
  const stats: Record<string, { activeKeys: number; totalRequests: number }> = {};
  
  for (const [name, limiter] of rateLimiters.entries()) {
    const activeKeys = (limiter as any).requests.size;
    let totalRequests = 0;
    
    for (const timestamps of (limiter as any).requests.values()) {
      totalRequests += timestamps.length;
    }
    
    stats[name] = { activeKeys, totalRequests };
  }
  
  return stats;
}

/**
 * Reset all rate limiters (for testing)
 */
export function resetAllRateLimiters(): void {
  for (const limiter of rateLimiters.values()) {
    limiter.reset();
  }
}
