# Rate Limiting Implementation Guide

## Overview

The rate limiting middleware provides configurable request throttling for Azure Functions using a sliding window algorithm. This ensures API stability, prevents abuse, and controls LLM costs.

## Architecture

- **Algorithm:** Sliding window (tracks timestamps for each request)
- **Storage:** In-memory (suitable for single-instance Azure Functions)
- **Cleanup:** Automatic memory management to prevent leaks
- **Headers:** RFC 6585 compliant with `Retry-After` and `X-RateLimit-*` headers

## Rate Limits by Endpoint

| Endpoint | Limit | Rationale |
|----------|-------|-----------|
| CSV Upload | 5/minute | Prevents rapid batch uploads that could exceed LLM budget |
| Photo OCR | 10/minute | Balance between UX and API cost (more frequent than CSV) |
| Micro-Review | 30/minute | User-driven actions, needs responsive feel |
| Parse Job Polling | 120/minute (2/sec) | Frontend polls every 500ms during processing |
| Default | 60/minute | Catch-all for other endpoints |

## Usage

### 1. Basic Usage

```typescript
import { rateLimitMiddleware, RATE_LIMITS } from '../middleware/rateLimiter';

export async function httpTrigger(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Apply rate limiting
  const rateLimitResult = rateLimitMiddleware(req, RATE_LIMITS.CSV_UPLOAD);
  if (rateLimitResult) {
    return rateLimitResult; // Return 429 response
  }
  
  // ... rest of function logic
  
  const response: HttpResponseInit = {
    status: 200,
    jsonBody: { data: 'Success' }
  };
  
  // Add rate limit headers
  addRateLimitHeaders(response, req);
  return response;
}
```

### 2. Custom Rate Limit

```typescript
import { rateLimitMiddleware, RateLimitConfig } from '../middleware/rateLimiter';

const customLimit: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  keyGenerator: (req) => req.headers.get('x-api-key') || 'anonymous'
};

const rateLimitResult = rateLimitMiddleware(req, customLimit, 'my-endpoint');
```

### 3. Custom Key Generator

By default, the middleware uses `userId` from query params or `x-user-id` header. For different keying strategies:

```typescript
const config: RateLimitConfig = {
  maxRequests: 50,
  windowMs: 60000,
  keyGenerator: (req) => {
    // Rate limit by household instead of user
    return req.query.get('householdId') || 'unknown';
  }
};
```

## Response Format

### Success (200)

```json
{
  "success": true,
  "data": { ... }
}
```

**Headers:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 2024-01-15T10:30:00.000Z
```

### Rate Limit Exceeded (429)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Maximum 5 requests per 60 seconds.",
    "details": {
      "maxRequests": 5,
      "windowSeconds": 60,
      "retryAfter": 42
    }
  }
}
```

**Headers:**
```
Retry-After: 42
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-01-15T10:31:00.000Z
```

### Missing User ID (400)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Rate limiting error: Missing userId parameter",
    "details": {
      "field": "userId"
    }
  }
}
```

## Client Implementation

### Polling with Rate Limits

Frontend should poll parse jobs at 500ms intervals (within 120/min limit):

```typescript
async function pollParseJob(jobId: string, userId: string) {
  const maxAttempts = 120; // 1 minute @ 500ms intervals
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(
        `/api/parsing/parseJobs/${jobId}?userId=${userId}`
      );
      
      if (response.ok) {
        const job = await response.json();
        
        if (job.status === 'completed' || job.status === 'needs_review') {
          return job;
        }
      } else if (response.status === 429) {
        // Rate limit exceeded (shouldn't happen at 500ms interval)
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
        await sleep(retryAfter * 1000);
        continue;
      }
      
      await sleep(500);
      attempts++;
    } catch (error) {
      console.error('Polling error:', error);
      await sleep(2000); // Back off on error
      attempts++;
    }
  }
  
  throw new Error('Polling timeout');
}
```

### Exponential Backoff

For operations that may hit rate limits:

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<Response>,
  maxRetries: number = 5
): Promise<T> {
  let retries = 0;
  
  while (true) {
    try {
      const response = await fn();
      
      if (response.status === 429 && retries < maxRetries) {
        // Read Retry-After header
        const retryAfter = parseInt(response.headers.get('Retry-After') || '0');
        const backoffMs = retryAfter > 0 
          ? retryAfter * 1000 
          : Math.min(1000 * Math.pow(2, retries), 60000); // Exponential: 1s, 2s, 4s, 8s...
        
        console.warn(`Rate limited, retrying in ${backoffMs}ms`);
        await sleep(backoffMs);
        retries++;
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (retries >= maxRetries) {
        throw error;
      }
      retries++;
    }
  }
}

// Usage
const result = await retryWithBackoff<ParseJobResponse>(
  () => fetch(`/api/parsing/csv`, { 
    method: 'POST', 
    body: JSON.stringify(data) 
  })
);
```

### User Feedback

Show rate limit status to users:

```typescript
function RateLimitIndicator({ response }: { response: Response }) {
  const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '0');
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
  const percentUsed = ((limit - remaining) / limit) * 100;
  
  return (
    <div className="rate-limit-status">
      {percentUsed > 80 && (
        <span className="warning">
          ⚠️ Approaching rate limit ({remaining}/{limit} requests remaining)
        </span>
      )}
    </div>
  );
}
```

## Monitoring & Debugging

### Get Rate Limiter Stats

```typescript
import { getRateLimiterStats } from '../middleware/rateLimiter';

// In monitoring endpoint
const stats = getRateLimiterStats();
// Returns: { 'parsing/csv': { activeKeys: 42, totalRequests: 156 }, ... }
```

### Reset Rate Limiters (Testing Only)

```typescript
import { resetAllRateLimiters } from '../middleware/rateLimiter';

// In test setup
beforeEach(() => {
  resetAllRateLimiters();
});
```

### Azure Monitor Queries

Track rate limit violations:

```kusto
traces
| where message contains "Rate limit exceeded"
| summarize count() by bin(timestamp, 5m), operation_Name
| render timechart
```

## Production Considerations

### Distributed Rate Limiting

Current implementation uses in-memory storage, suitable for:
- Single-instance Azure Functions
- Expected < 1000 concurrent users (MVP)

For production scale:

1. **Redis Implementation:**
   ```typescript
   import { createClient } from 'redis';
   
   const redis = createClient({ url: process.env.REDIS_URL });
   
   class RedisRateLimiter {
     async check(key: string): Promise<{ allowed: boolean }> {
       const count = await redis.incr(key);
       if (count === 1) {
         await redis.expire(key, this.windowMs / 1000);
       }
       return { allowed: count <= this.maxRequests };
     }
   }
   ```

2. **Cosmos DB Implementation:**
   - Store rate limit counters in Cosmos DB container
   - Use TTL for automatic cleanup
   - Query with `SELECT * FROM c WHERE c.userId = @userId AND c.timestamp > @windowStart`

### Cost Analysis

- **Memory Usage:** ~100 bytes per active user (1000 users = 100KB)
- **CPU Overhead:** <1ms per request (hash map lookup)
- **Cleanup:** Runs when map exceeds 10,000 entries

### Security

Rate limiting is a **security control** to prevent:
- Denial of Service (DoS) attacks
- API abuse and scraping
- Budget exhaustion attacks (LLM cost blowout)

Combine with:
- Authentication (MSAL)
- Input validation (Joi schemas)
- Cost circuit breakers (budget enforcement)

## Testing

### Unit Tests

```typescript
import { rateLimitMiddleware, RATE_LIMITS, resetAllRateLimiters } from '../middleware/rateLimiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    resetAllRateLimiters();
  });
  
  it('should allow requests within limit', () => {
    const req = createMockRequest({ userId: 'user1' });
    
    for (let i = 0; i < 5; i++) {
      const result = rateLimitMiddleware(req, RATE_LIMITS.CSV_UPLOAD);
      expect(result).toBeNull(); // Should pass
    }
  });
  
  it('should block requests exceeding limit', () => {
    const req = createMockRequest({ userId: 'user1' });
    
    // Exhaust limit
    for (let i = 0; i < 5; i++) {
      rateLimitMiddleware(req, RATE_LIMITS.CSV_UPLOAD);
    }
    
    // 6th request should be blocked
    const result = rateLimitMiddleware(req, RATE_LIMITS.CSV_UPLOAD);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
    expect(result?.headers?.['Retry-After']).toBeDefined();
  });
  
  it('should reset after window expires', async () => {
    const config = { maxRequests: 2, windowMs: 100 };
    const req = createMockRequest({ userId: 'user1' });
    
    // Exhaust limit
    rateLimitMiddleware(req, config);
    rateLimitMiddleware(req, config);
    
    // Should be blocked
    let result = rateLimitMiddleware(req, config);
    expect(result?.status).toBe(429);
    
    // Wait for window to expire
    await sleep(150);
    
    // Should be allowed again
    result = rateLimitMiddleware(req, config);
    expect(result).toBeNull();
  });
});
```

### Integration Tests

```typescript
describe('CSV Upload with Rate Limiting', () => {
  it('should enforce 5 requests/minute limit', async () => {
    const userId = 'test-user-' + Date.now();
    const csvData = { csvText: 'test', source: 'AMAZON', householdId: 'hh1', userId };
    
    // Send 5 requests (should succeed)
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post('/api/parsing/csv')
        .query({ userId })
        .send(csvData);
      
      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-remaining']).toBe((4 - i).toString());
    }
    
    // 6th request should be rate limited
    const response = await request(app)
      .post('/api/parsing/csv')
      .query({ userId })
      .send(csvData);
    
    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBeDefined();
  });
});
```

## FAQ

**Q: Why not use Azure API Management (APIM) for rate limiting?**
A: APIM adds cost ($50+/month) and complexity for MVP. Current implementation is free and sufficient for expected load. Consider APIM for production scale.

**Q: Can different users in the same household share rate limits?**
A: Currently rate limits are per-user. To share by household, use custom `keyGenerator`:
```typescript
keyGenerator: (req) => req.query.get('householdId')
```

**Q: What happens to rate limits on Function App restarts?**
A: In-memory counters reset. This is acceptable for MVP. For persistent limits, use Redis or Cosmos DB.

**Q: How do I test rate limiting locally?**
A: Use the `resetAllRateLimiters()` helper between tests. For manual testing, reduce window size (e.g., 10 seconds instead of 60).

## References

- [RFC 6585 - Additional HTTP Status Codes (429)](https://tools.ietf.org/html/rfc6585#section-4)
- [Azure Functions Best Practices](https://learn.microsoft.com/en-us/azure/azure-functions/functions-best-practices)
- [PRD Section 10 - Cost Controls](/docs/specs/PRD_Kirana.md#10-cost--infrastructure-constraints)
