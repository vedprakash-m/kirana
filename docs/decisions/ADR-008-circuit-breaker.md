# ADR-008: Circuit Breaker for External Dependencies

**Status:** Accepted  
**Date:** 2025-11-03  
**Deciders:** Engineering Team  
**Tags:** resilience, circuit-breaker, error-handling, reliability

## Context

Kirana integrates with multiple external services that can fail:
1. **Google Gemini API**: LLM parsing for CSV/receipt import (rate limits, timeouts, API outages)
2. **Azure Cosmos DB**: Database operations (throttling 429 errors, network issues)
3. **Azure Blob Storage**: Receipt image storage (rare outages)
4. **Azure Application Insights**: Telemetry logging (non-critical, can degrade gracefully)

Problems with naive retry logic:
- **Cascading failures**: Service down → retry flood → worse failure
- **Resource exhaustion**: Too many pending requests → memory leak
- **User frustration**: Retry 10× over 60s → user gives up
- **Cost explosion**: 1,000 failed requests × 5 retries = 5,000 requests = $$$

We evaluated three resilience patterns:
1. **Exponential Backoff Retry**: Retry with increasing delays (simple, no state)
2. **Circuit Breaker**: Stop calling failing service, retry after cooldown (stateful)
3. **Bulkhead**: Isolate failures to prevent cascading (resource pools)

## Decision

We will implement a **Circuit Breaker** pattern for all external dependencies, combined with **Exponential Backoff Retry** for transient failures.

### Circuit Breaker States

```
     ┌─────────┐
     │ CLOSED  │  (Normal operation)
     │  0% ✓   │  All requests go through
     └────┬────┘
          │ Failure threshold exceeded (50% over 10 requests)
          ▼
     ┌─────────┐
     │  OPEN   │  (Service failing)
     │ 100% ✗  │  All requests fail fast (no API call)
     └────┬────┘
          │ Timeout expires (30s cooldown)
          ▼
     ┌─────────┐
     │HALF-OPEN│  (Testing recovery)
     │  50% ✓  │  Limited requests pass through
     └────┬────┘
          │ Success → CLOSED, Failure → OPEN
          ▼
```

### Configuration

| Service | Failure Threshold | Timeout | Half-Open Requests | Retry Attempts |
|---------|------------------|---------|-------------------|----------------|
| Gemini API | 50% over 10 req | 30s | 3 | 3 (1s, 2s, 4s) |
| Cosmos DB | 3 consecutive 429 | 10s | 5 | 5 (0.5s, 1s, 2s, 4s, 8s) |
| Blob Storage | 5 consecutive fails | 60s | 2 | 3 (1s, 2s, 4s) |
| App Insights | N/A (degrade only) | - | - | 0 (fire-and-forget) |

### Implementation

```typescript
// utils/circuitBreaker.ts
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // % failures to trip (0-1)
  windowSize: number;             // Rolling window size (requests)
  timeout: number;                // Cooldown duration (ms)
  halfOpenRequests: number;       // Requests allowed in half-open
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private requests: boolean[] = []; // Rolling window (true=success, false=failure)
  private nextAttempt: number = 0;   // Timestamp when can retry
  private halfOpenCount: number = 0;
  
  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // OPEN state: Fail fast (no API call)
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker OPEN for ${this.name}. Retry after ${new Date(this.nextAttempt).toISOString()}`);
      }
      // Timeout expired → move to HALF_OPEN
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenCount = 0;
    }
    
    // HALF_OPEN state: Limited requests
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCount >= this.config.halfOpenRequests) {
        throw new Error(`Circuit breaker HALF_OPEN for ${this.name}. Too many test requests.`);
      }
      this.halfOpenCount++;
    }
    
    // Execute request
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
  
  private recordSuccess(): void {
    this.successes++;
    this.requests.push(true);
    this.trimWindow();
    
    if (this.state === CircuitState.HALF_OPEN) {
      // All half-open requests succeeded → CLOSED
      if (this.halfOpenCount >= this.config.halfOpenRequests) {
        this.state = CircuitState.CLOSED;
        this.reset();
      }
    }
  }
  
  private recordFailure(): void {
    this.failures++;
    this.requests.push(false);
    this.trimWindow();
    
    const failureRate = this.failures / this.requests.length;
    
    if (
      this.requests.length >= this.config.windowSize &&
      failureRate >= this.config.failureThreshold
    ) {
      // Trip circuit → OPEN
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.timeout;
      
      // Log to App Insights
      console.error(`Circuit breaker OPEN for ${this.name}. Failure rate: ${(failureRate * 100).toFixed(1)}%`);
    }
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open → OPEN
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.timeout;
    }
  }
  
  private trimWindow(): void {
    if (this.requests.length > this.config.windowSize) {
      const removed = this.requests.shift();
      if (removed === true) this.successes--;
      else this.failures--;
    }
  }
  
  private reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.requests = [];
    this.halfOpenCount = 0;
  }
  
  getState(): { state: CircuitState; failureRate: number; nextAttempt: Date | null } {
    return {
      state: this.state,
      failureRate: this.requests.length > 0 ? this.failures / this.requests.length : 0,
      nextAttempt: this.state === CircuitState.OPEN ? new Date(this.nextAttempt) : null
    };
  }
}
```

### Exponential Backoff Retry

```typescript
// utils/retryPolicy.ts
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;     // ms
  maxDelay: number;         // ms
  backoffMultiplier: number;
  retryableErrors: string[]; // Error codes to retry (e.g., 'ETIMEDOUT', '429')
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let attempt = 0;
  let delay = config.initialDelay;
  
  while (attempt < config.maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      // Don't retry if not retryable error
      if (!isRetryable(error, config.retryableErrors)) {
        throw error;
      }
      
      // Last attempt failed → throw
      if (attempt >= config.maxAttempts) {
        throw new Error(`Max retry attempts (${config.maxAttempts}) exceeded. Last error: ${error.message}`);
      }
      
      // Wait with exponential backoff + jitter
      const jitter = Math.random() * 0.3 * delay; // ±30% jitter
      const waitTime = Math.min(delay + jitter, config.maxDelay);
      
      console.warn(`Retry attempt ${attempt}/${config.maxAttempts} after ${waitTime.toFixed(0)}ms. Error: ${error.message}`);
      
      await sleep(waitTime);
      delay *= config.backoffMultiplier;
    }
  }
  
  throw new Error('Retry logic failed unexpectedly');
}

function isRetryable(error: any, retryableCodes: string[]): boolean {
  const code = error.code || error.statusCode?.toString();
  return retryableCodes.includes(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Service-Specific Configurations

**1. Gemini LLM Service**
```typescript
// services/LLMService.ts
import { CircuitBreaker } from '../utils/circuitBreaker';
import { retryWithBackoff } from '../utils/retryPolicy';

const geminiCircuitBreaker = new CircuitBreaker('Gemini API', {
  failureThreshold: 0.5,  // 50% failure rate
  windowSize: 10,
  timeout: 30000,         // 30s cooldown
  halfOpenRequests: 3
});

const geminiRetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 4000,
  backoffMultiplier: 2,
  retryableErrors: ['ETIMEDOUT', '429', '503']
};

export async function callGeminiAPI(prompt: string): Promise<string> {
  return geminiCircuitBreaker.execute(async () => {
    return retryWithBackoff(async () => {
      const response = await fetch('https://generativelanguage.googleapis.com/v1/...', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
        headers: { 'Authorization': `Bearer ${process.env.GOOGLE_AI_API_KEY}` }
      });
      
      if (!response.ok) {
        const error = new Error(`Gemini API error: ${response.statusText}`);
        error.statusCode = response.status;
        throw error;
      }
      
      return response.json();
    }, geminiRetryConfig);
  });
}
```

**2. Cosmos DB Service**
```typescript
// services/CosmosService.ts
const cosmosCircuitBreaker = new CircuitBreaker('Cosmos DB', {
  failureThreshold: 1.0,  // 3 consecutive 429s (100% in window of 3)
  windowSize: 3,
  timeout: 10000,         // 10s cooldown
  halfOpenRequests: 5
});

const cosmosRetryConfig = {
  maxAttempts: 5,
  initialDelay: 500,
  maxDelay: 8000,
  backoffMultiplier: 2,
  retryableErrors: ['429', 'ETIMEDOUT', 'ECONNRESET']
};

export async function queryItems(householdId: string): Promise<Item[]> {
  return cosmosCircuitBreaker.execute(async () => {
    return retryWithBackoff(async () => {
      const { resources } = await container.items
        .query({ query: 'SELECT * FROM c WHERE c.householdId = @id', parameters: [{ name: '@id', value: householdId }] })
        .fetchAll();
      return resources;
    }, cosmosRetryConfig);
  });
}
```

## Consequences

### Positive

✅ **Fail fast**: Users get immediate error (no 60s wait) when service is down  
✅ **Resource protection**: Stops calling failing service → prevents resource exhaustion  
✅ **Cost savings**: No wasted retries to unavailable service ($0 vs $100 in retry costs)  
✅ **Cascading failure prevention**: Failing dependency doesn't crash entire app  
✅ **Self-healing**: Automatically retries after cooldown (no manual intervention)  
✅ **Monitoring**: Circuit state tracked in App Insights (alerts on OPEN)  
✅ **Graceful degradation**: CSV import fails → offer manual entry fallback  

### Negative

❌ **Complexity**: More code to maintain (circuit breaker + retry logic)  
❌ **State management**: Circuit breaker state in memory (lost on cold start)  
❌ **False positives**: Brief outage trips circuit → blocks valid requests for 30s  
❌ **Configuration tuning**: Need to tune thresholds per service (trial and error)  
❌ **Testing harder**: Need to simulate failures to test circuit breaker  

### Alternatives Considered

**Exponential Backoff Only**:
- ❌ Rejected: Doesn't prevent cascading failures (keeps retrying dying service)
- ❌ No fail-fast behavior (user waits full retry cycle)
- ✅ Simpler implementation (no state)
- ❌ Higher costs (retry spam)

**Bulkhead Pattern**:
- ❌ Rejected: Overkill for MVP (need thread pools, semaphores)
- ✅ Better isolation (one service failure doesn't affect others)
- ❌ More complex (need worker queues)
- ✅ Good for high-traffic systems (not MVP scale)

**Timeout Only**:
- ❌ Rejected: Doesn't track failure rates (can't detect systemic issues)
- ❌ No fail-fast (waits full timeout every time)
- ✅ Simplest implementation
- ❌ No protection against cascading failures

**Polly (C# library) / resilience4j (Java)**:
- ❌ Rejected: No mature Node.js equivalent (opossum exists but less mature)
- ✅ Battle-tested patterns
- ❌ Need to implement custom for TypeScript

## Implementation Notes

### Monitoring

```typescript
// App Insights custom metric
export function trackCircuitBreakerState(breaker: CircuitBreaker): void {
  const { state, failureRate } = breaker.getState();
  
  appInsights.defaultClient.trackMetric({
    name: 'circuit_breaker_state',
    value: state === CircuitState.OPEN ? 1 : 0,
    properties: {
      breakerName: breaker.name,
      state: state,
      failureRate: failureRate.toFixed(2)
    }
  });
}

// Alert rule (Azure Monitor)
// Alert if circuit breaker OPEN for >5 minutes
// KQL query:
// customMetrics
// | where name == "circuit_breaker_state"
// | where value == 1
// | summarize count() by bin(timestamp, 5m)
// | where count_ > 0
```

### Fallback Strategies

```typescript
// CSV Import with fallback
export async function importCSV(file: File): Promise<ImportResult> {
  try {
    // Try LLM parsing
    return await callGeminiAPI(file.content);
  } catch (error) {
    if (error.message.includes('Circuit breaker OPEN')) {
      // Fallback: Offer manual entry
      return {
        success: false,
        error: 'LLM service temporarily unavailable. Please enter items manually.',
        fallbackUrl: '/items/manual-entry'
      };
    }
    throw error;
  }
}
```

### Testing

```typescript
// Test circuit breaker (unit test)
import { CircuitBreaker, CircuitState } from '../utils/circuitBreaker';

test('circuit opens after threshold failures', async () => {
  const breaker = new CircuitBreaker('test', {
    failureThreshold: 0.5,
    windowSize: 10,
    timeout: 1000,
    halfOpenRequests: 2
  });
  
  // Trigger 6 failures out of 10 requests (60% > 50% threshold)
  for (let i = 0; i < 6; i++) {
    await expect(breaker.execute(async () => { throw new Error('fail'); }))
      .rejects.toThrow('fail');
  }
  
  // Next request should fail fast (circuit OPEN)
  await expect(breaker.execute(async () => 'success'))
    .rejects.toThrow('Circuit breaker OPEN');
  
  expect(breaker.getState().state).toBe(CircuitState.OPEN);
});
```

## Migration Strategy

If circuit breaker becomes insufficient:
1. **Phase 1**: Add distributed circuit breaker (Redis-backed state)
2. **Phase 2**: Implement bulkhead pattern for resource isolation
3. **Phase 3**: Use Azure API Management rate limiting (offload to infrastructure)

## References

- [Circuit Breaker Pattern (Martin Fowler)](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Microsoft Resilience Patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
- [opossum (Node.js Circuit Breaker)](https://github.com/nodeshift/opossum)
- PRD Section 9.2: "Error Handling & Resilience"
- Tech Spec Section 5.3: "Fault Tolerance"

## Review History

- 2025-11-03: Initial version (Accepted)
