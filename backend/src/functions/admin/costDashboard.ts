/**
 * Cost Monitoring Dashboard API
 * 
 * Admin endpoint for visualizing LLM cost spend across users and operations.
 * 
 * Endpoints:
 * - GET /api/admin/cost/summary - Overall cost summary
 * - GET /api/admin/cost/by-day - Daily spend breakdown (last 30 days)
 * - GET /api/admin/cost/by-user - User spend leaderboard
 * - GET /api/admin/cost/by-operation - Operation breakdown (parse vs predict)
 * 
 * Authentication: Requires admin role (role claim in JWT)
 * 
 * Integration: Designed for Azure Dashboard / Power BI consumption
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getCosmosDbService } from '../../services/cosmosDbService';
import { CostTracking, ApiResponse, ErrorCode } from '../../types/shared';
import { Container } from '@azure/cosmos';

/**
 * Cost summary aggregates
 */
interface CostSummary {
  totalSpend: number;
  last30DaysSpend: number;
  todaySpend: number;
  totalUsers: number;
  totalOperations: number;
  averagePerUser: number;
  averagePerOperation: number;
  budgetUtilization: {
    systemDaily: number;  // % of daily budget used
    topUserMonthly: number;  // % of monthly budget used by top user
  };
}

/**
 * Daily spend data point
 */
interface DailySpend {
  date: string;  // YYYY-MM-DD
  totalSpend: number;
  operationCount: number;
  uniqueUsers: number;
}

/**
 * User spend data
 */
interface UserSpend {
  userId: string;
  totalSpend: number;
  operationCount: number;
  lastOperation: string;  // ISO 8601
  monthlySpend: number;
  budgetUtilization: number;  // % of $0.20 cap
}

/**
 * Operation breakdown
 */
interface OperationBreakdown {
  operation: string;  // e.g., "parse_csv", "predict_runout"
  count: number;
  totalSpend: number;
  averageCost: number;
  averageInputTokens: number;
  averageOutputTokens: number;
}

/**
 * Get cost tracking container
 */
async function getCostContainer(): Promise<Container> {
  const cosmosService = await getCosmosDbService();
  return cosmosService.getCostTrackingContainer();
}

/**
 * Check if user has admin role
 */
function isAdmin(request: HttpRequest): boolean {
  // In production, validate JWT claims for admin role
  // For now, check header or query param (development only)
  const adminKey = request.headers.get('x-admin-key');
  const envAdminKey = process.env.ADMIN_KEY || 'dev-admin-key';
  
  return adminKey === envAdminKey;
}

/**
 * Create error response
 */
function createErrorResponse(
  code: ErrorCode,
  message: string,
  statusCode: number
): HttpResponseInit {
  const response: ApiResponse<null> = {
    success: false,
    error: { code, message },
    data: null,
  };
  return {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
    jsonBody: response,
  };
}

/**
 * Create success response
 */
function createSuccessResponse<T>(data: T): HttpResponseInit {
  const response: ApiResponse<T> = {
    success: true,
    data,
    error: undefined,
  };
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    jsonBody: response,
  };
}

/**
 * GET /api/admin/cost/summary
 * Overall cost summary
 */
async function getCostSummary(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!isAdmin(request)) {
    return createErrorResponse(ErrorCode.FORBIDDEN, 'Admin access required', 403);
  }

  try {
    const container = await getCostContainer();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Query all cost records (last 30 days)
    const query = `
      SELECT * FROM c 
      WHERE c.createdAt >= @thirtyDaysAgo 
      ORDER BY c.createdAt DESC
    `;
    
    const { resources: records } = await container.items
      .query<CostTracking>({
        query,
        parameters: [{ name: '@thirtyDaysAgo', value: thirtyDaysAgo.toISOString() }],
      })
      .fetchAll();

    // Aggregate data
    const totalSpend = records.reduce((sum, r) => sum + r.llmCostUSD, 0);
    const todayRecords = records.filter(r => new Date(r.createdAt) >= startOfDay);
    const todaySpend = todayRecords.reduce((sum, r) => sum + r.llmCostUSD, 0);
    const uniqueUsers = new Set(records.map(r => r.userId).filter(Boolean)).size;
    const totalOperations = records.length;

    // User monthly spend (current month)
    const monthRecords = records.filter(r => new Date(r.createdAt) >= startOfMonth);
    const userMonthlySpend = new Map<string, number>();
    monthRecords.forEach(r => {
      if (r.userId) {
        const current = userMonthlySpend.get(r.userId) || 0;
        userMonthlySpend.set(r.userId, current + r.llmCostUSD);
      }
    });
    const topUserMonthly = Math.max(...Array.from(userMonthlySpend.values()), 0);
    const totalUsers = uniqueUsers;

    const summary: CostSummary = {
      totalSpend,
      last30DaysSpend: totalSpend,
      todaySpend,
      totalUsers: uniqueUsers,
      totalOperations,
      averagePerUser: uniqueUsers > 0 ? totalSpend / uniqueUsers : 0,
      averagePerOperation: totalOperations > 0 ? totalSpend / totalOperations : 0,
      budgetUtilization: {
        systemDaily: (todaySpend / 50.0) * 100,  // % of $50 daily cap
        topUserMonthly: (topUserMonthly / 0.20) * 100,  // % of $0.20 monthly cap
      },
    };

    context.info('Cost summary retrieved', { totalSpend, todaySpend, totalUsers });
    return createSuccessResponse(summary);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('Error fetching cost summary:', error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, errorMessage, 500);
  }
}

/**
 * GET /api/admin/cost/by-day
 * Daily spend breakdown (last 30 days)
 */
async function getCostByDay(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!isAdmin(request)) {
    return createErrorResponse(ErrorCode.FORBIDDEN, 'Admin access required', 403);
  }

  try {
    const container = await getCostContainer();
    const days = parseInt(request.query.get('days') || '30', 10);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const query = `
      SELECT * FROM c 
      WHERE c.createdAt >= @startDate 
      ORDER BY c.createdAt ASC
    `;
    
    const { resources: records } = await container.items
      .query<CostTracking>({
        query,
        parameters: [{ name: '@startDate', value: startDate.toISOString() }],
      })
      .fetchAll();

    // Group by day
    const dailyMap = new Map<string, { spend: number; operations: Set<string>; users: Set<string> }>();
    records.forEach(record => {
      const date = record.createdAt.split('T')[0];  // YYYY-MM-DD
      const current = dailyMap.get(date) || { spend: 0, operations: new Set(), users: new Set() };
      current.spend += record.llmCostUSD;
      current.operations.add(record.id);
      if (record.userId) {
        current.users.add(record.userId);
      }
      dailyMap.set(date, current);
    });

    // Convert to array
    const dailySpend: DailySpend[] = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        totalSpend: data.spend,
        operationCount: data.operations.size,
        uniqueUsers: data.users.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    context.info(`Retrieved daily spend for ${days} days`, { dataPoints: dailySpend.length });
    return createSuccessResponse(dailySpend);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('Error fetching daily cost:', error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, errorMessage, 500);
  }
}

/**
 * GET /api/admin/cost/by-user
 * User spend leaderboard
 */
async function getCostByUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!isAdmin(request)) {
    return createErrorResponse(ErrorCode.FORBIDDEN, 'Admin access required', 403);
  }

  try {
    const container = await getCostContainer();
    const limit = parseInt(request.query.get('limit') || '50', 10);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const query = `
      SELECT * FROM c 
      WHERE c.userId != null
      ORDER BY c.createdAt DESC
    `;
    
    const { resources: records } = await container.items
      .query<CostTracking>({ query })
      .fetchAll();

    // Group by user
    const userMap = new Map<string, { total: number; count: number; lastOp: string; monthly: number }>();
    records.forEach(record => {
      if (!record.userId) return;
      
      const current = userMap.get(record.userId) || { total: 0, count: 0, lastOp: '', monthly: 0 };
      current.total += record.llmCostUSD;
      current.count += 1;
      if (!current.lastOp || record.createdAt > current.lastOp) {
        current.lastOp = record.createdAt;
      }
      if (new Date(record.createdAt) >= startOfMonth) {
        current.monthly += record.llmCostUSD;
      }
      userMap.set(record.userId, current);
    });

    // Convert to array and sort by spend
    const userSpend: UserSpend[] = Array.from(userMap.entries())
      .map(([userId, data]) => ({
        userId,
        totalSpend: data.total,
        operationCount: data.count,
        lastOperation: data.lastOp,
        monthlySpend: data.monthly,
        budgetUtilization: (data.monthly / 0.20) * 100,  // % of $0.20 cap
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, limit);

    context.info(`Retrieved user spend leaderboard`, { users: userSpend.length });
    return createSuccessResponse(userSpend);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('Error fetching user cost:', error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, errorMessage, 500);
  }
}

/**
 * GET /api/admin/cost/by-operation
 * Operation breakdown (by period type)
 */
async function getCostByOperation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!isAdmin(request)) {
    return createErrorResponse(ErrorCode.FORBIDDEN, 'Admin access required', 403);
  }

  try {
    const container = await getCostContainer();
    const days = parseInt(request.query.get('days') || '30', 10);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const query = `
      SELECT * FROM c 
      WHERE c.createdAt >= @startDate 
      ORDER BY c.createdAt DESC
    `;
    
    const { resources: records } = await container.items
      .query<CostTracking>({
        query,
        parameters: [{ name: '@startDate', value: startDate.toISOString() }],
      })
      .fetchAll();

    // Group by period type (since we don't track individual operations)
    const operationMap = new Map<string, { count: number; totalCost: number; totalInputTokens: number; totalOutputTokens: number }>();
    records.forEach(record => {
      const operation = `${record.periodType}_tracking`;
      const current = operationMap.get(operation) || { count: 0, totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0 };
      current.count += 1;
      current.totalCost += record.llmCostUSD;
      current.totalInputTokens += record.llmTokensIn;
      current.totalOutputTokens += record.llmTokensOut;
      operationMap.set(operation, current);
    });

    // Convert to array
    const operationBreakdown: OperationBreakdown[] = Array.from(operationMap.entries())
      .map(([operation, data]) => ({
        operation,
        count: data.count,
        totalSpend: data.totalCost,
        averageCost: data.totalCost / data.count,
        averageInputTokens: data.totalInputTokens / data.count,
        averageOutputTokens: data.totalOutputTokens / data.count,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);

    context.info(`Retrieved operation breakdown`, { operations: operationBreakdown.length });
    return createSuccessResponse(operationBreakdown);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('Error fetching operation cost:', error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, errorMessage, 500);
  }
}

// Register HTTP endpoints
app.http('costSummary', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'admin/cost/summary',
  handler: getCostSummary,
});

app.http('costByDay', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'admin/cost/by-day',
  handler: getCostByDay,
});

app.http('costByUser', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'admin/cost/by-user',
  handler: getCostByUser,
});

app.http('costByOperation', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'admin/cost/by-operation',
  handler: getCostByOperation,
});
