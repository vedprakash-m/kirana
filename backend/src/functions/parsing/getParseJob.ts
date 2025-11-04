/**
 * Parse Job Polling Endpoint
 * 
 * GET /api/parsing/parseJobs/{jobId}
 * 
 * Returns:
 * - status: pending, processing, completed, failed, needs_review, queued
 * - progress: {totalLines, parsed, autoAccepted, needsReview, failed, percentComplete}
 * - results: Array of ParsedItem (when completed/needs_review)
 * - createdAt, completedAt timestamps
 * 
 * Rate Limiting: 2 requests/second per user (120/minute)
 * - Frontend can poll every 500ms without hitting limit
 * - Returns 429 with Retry-After header (in seconds) when exceeded
 * 
 * Purpose:
 * - Frontend polls this endpoint every 500ms during CSV processing
 * - Shows progress bar and parsed items as they become available
 * - Triggers micro-review UI when status = needs_review
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getCosmosDbService } from '../../services/cosmosDbService';
import {
  ParseJob,
  ParseJobStatus,
  ErrorCode,
  ApiResponse
} from '../../types/shared';

/**
 * Progress metrics for parse job
 */
interface ParseJobProgress {
  totalLines: number;
  parsed: number;
  autoAccepted: number;
  needsReview: number;
  failed: number;
  percentComplete: number;
}

/**
 * Parse job response
 */
interface ParseJobResponse {
  jobId: string;
  status: ParseJobStatus;
  progress: ParseJobProgress;
  results?: ParseJob['results'];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * In-memory rate limiter (simple implementation)
 * In production, use Redis for distributed rate limiting
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  /**
   * Check if request is allowed
   * Returns { allowed: boolean, retryAfter?: number }
   */
  check(userId: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    // Remove expired requests (outside window)
    const validRequests = userRequests.filter(timestamp => 
      now - timestamp < this.windowMs
    );
    
    if (validRequests.length >= this.maxRequests) {
      // Rate limit exceeded
      const oldestRequest = Math.min(...validRequests);
      const retryAfter = Math.ceil((oldestRequest + this.windowMs - now) / 1000);
      return { allowed: false, retryAfter };
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(userId, validRequests);
    
    // Cleanup old entries periodically
    if (this.requests.size > 10000) {
      this.cleanup();
    }
    
    return { allowed: true };
  }
  
  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [userId, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
      if (validTimestamps.length === 0) {
        this.requests.delete(userId);
      } else {
        this.requests.set(userId, validTimestamps);
      }
    }
  }
}

// Rate limiter: 120 requests per minute (2 per second)
const rateLimiter = new RateLimiter(120, 60 * 1000);

/**
 * Calculate progress metrics from parse job
 */
function calculateProgress(job: ParseJob): ParseJobProgress {
  const results = job.results || [];
  const totalLines = results.length;
  const autoAccepted = results.filter(r => !r.needsReview).length;
  const needsReview = results.filter(r => r.needsReview).length;
  const failed = 0; // TODO: Track failed parses
  
  let percentComplete = 0;
  if (job.status === ParseJobStatus.COMPLETED || job.status === ParseJobStatus.NEEDS_REVIEW) {
    percentComplete = 100;
  } else if (job.status === ParseJobStatus.PROCESSING) {
    percentComplete = totalLines > 0 ? Math.floor((autoAccepted + needsReview) / totalLines * 100) : 0;
  }
  
  return {
    totalLines,
    parsed: autoAccepted + needsReview,
    autoAccepted,
    needsReview,
    failed,
    percentComplete
  };
}

/**
 * Azure Function: Get Parse Job
 * 
 * GET /api/parsing/parseJobs/{jobId}?userId={userId}
 * 
 * Query params:
 * - userId: Required for rate limiting
 * 
 * Response: ParseJobResponse
 */
async function getParseJob(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const jobId = request.params.id;
    const userId = request.query.get('userId');
    
    // Validate input
    if (!jobId) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'jobId is required'
          }
        } as ApiResponse<never>
      };
    }
    
    if (!userId) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'userId query parameter is required for rate limiting'
          }
        } as ApiResponse<never>
      };
    }
    
    // Rate limiting check
    const rateLimitResult = rateLimiter.check(userId);
    if (!rateLimitResult.allowed) {
      context.warn(`Rate limit exceeded for user ${userId}`);
      return {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter!.toString(),
          'X-RateLimit-Limit': '120',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (Date.now() + (rateLimitResult.retryAfter! * 1000)).toString()
        },
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: `Rate limit exceeded. Please wait ${rateLimitResult.retryAfter} seconds before retrying.`
          }
        } as ApiResponse<never>
      };
    }
    
    // Fetch parse job from Cosmos DB
    const cosmosService = await getCosmosDbService();
    const parseJobsContainer = cosmosService.getParseJobsContainer();
    
    try {
      const { resource: job } = await parseJobsContainer
        .item(jobId, jobId)
        .read<ParseJob>();
      
      if (!job) {
        return {
          status: 404,
          jsonBody: {
            success: false,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Parse job not found: ${jobId}`
            }
          } as ApiResponse<never>
        };
      }
      
      // Calculate progress
      const progress = calculateProgress(job);
      
      // Build response
      const response: ParseJobResponse = {
        jobId: job.id,
        status: job.status,
        progress,
        results: job.status === ParseJobStatus.COMPLETED || job.status === ParseJobStatus.NEEDS_REVIEW 
          ? job.results 
          : undefined,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt
      };
      
      context.log(`Parse job ${jobId}: ${job.status} (${progress.percentComplete}%)`);
      
      return {
        status: 200,
        jsonBody: {
          success: true,
          data: response
        } as ApiResponse<ParseJobResponse>
      };
      
    } catch (error: any) {
      if (error.code === 404) {
        return {
          status: 404,
          jsonBody: {
            success: false,
            error: {
              code: ErrorCode.NOT_FOUND,
              message: `Parse job not found: ${jobId}`
            }
          } as ApiResponse<never>
        };
      }
      throw error;
    }
    
  } catch (error: any) {
    context.error('Error fetching parse job:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: `Failed to fetch parse job: ${error.message}`
        }
      } as ApiResponse<never>
    };
  }
}

/**
 * Azure Function: List Parse Jobs
 * 
 * GET /api/parsing/parseJobs?householdId={id}&userId={id}
 * 
 * Returns list of recent parse jobs for a household
 */
async function listParseJobs(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const householdId = request.query.get('householdId');
    const userId = request.query.get('userId');
    
    if (!householdId || !userId) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'householdId and userId query parameters are required'
          }
        } as ApiResponse<never>
      };
    }
    
    // Rate limiting check
    const rateLimitResult = rateLimiter.check(userId);
    if (!rateLimitResult.allowed) {
      return {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter!.toString()
        },
        jsonBody: {
          success: false,
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: `Rate limit exceeded. Please wait ${rateLimitResult.retryAfter} seconds.`
          }
        } as ApiResponse<never>
      };
    }
    
    // Fetch parse jobs
    const cosmosService = await getCosmosDbService();
    const parseJobsContainer = cosmosService.getParseJobsContainer();
    
    const query = {
      query: 'SELECT * FROM c WHERE c.householdId = @householdId ORDER BY c.createdAt DESC OFFSET 0 LIMIT 50',
      parameters: [
        { name: '@householdId', value: householdId }
      ]
    };
    
    const { resources: jobs } = await parseJobsContainer.items
      .query<ParseJob>(query)
      .fetchAll();
    
    // Build responses with progress
    const responses: ParseJobResponse[] = jobs.map(job => ({
      jobId: job.id,
      status: job.status,
      progress: calculateProgress(job),
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt
    }));
    
    context.log(`Listed ${jobs.length} parse jobs for household ${householdId}`);
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: responses
      } as ApiResponse<ParseJobResponse[]>
    };
    
  } catch (error: any) {
    context.error('Error listing parse jobs:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: `Failed to list parse jobs: ${error.message}`
        }
      } as ApiResponse<never>
    };
  }
}

// Register Azure Functions
app.http('parsing-get-job', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'parsing/parseJobs/{id}',
  handler: getParseJob
});

app.http('parsing-list-jobs', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'parsing/parseJobs',
  handler: listParseJobs
});
