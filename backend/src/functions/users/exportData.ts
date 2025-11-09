/**
 * Data Export API - GET /api/users/me/export
 * 
 * Purpose: GDPR Article 20 - Right to Data Portability
 * 
 * This endpoint allows users to export all their personal data in a
 * machine-readable format (JSON). This is a legal requirement under GDPR
 * and similar privacy regulations (CCPA, etc.).
 * 
 * Compliance:
 * - GDPR Article 20: Right to Data Portability
 * - CCPA Section 1798.100(d): Right to Access Personal Information
 * 
 * Security:
 * - Requires valid JWT token
 * - Users can only export their own data
 * - All exported data is filtered by userId
 * 
 * Data Included:
 * - User profile (personal information, preferences)
 * - Household memberships (role, join date)
 * - Inventory items (from all user's households)
 * - Purchase transactions (from all user's households)
 * - Audit logs (user's own actions)
 * - Active sessions (device tracking data)
 * 
 * Export Format:
 * - JSON format with clear structure
 * - Includes data dictionary for field explanations
 * - Downloadable file with timestamp in filename
 * - Excludes internal fields (_etag, internal IDs where appropriate)
 * 
 * Performance:
 * - Target: <5 seconds for typical user (50 items, 200 transactions)
 * - Data size limit: 10MB (warns if exceeded)
 * - Async processing for large exports (Phase 3)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateJWT } from '../../middleware/auth';
import { getCosmosDbService } from '../../services/cosmosDbService';
import { 
  ApiResponse, 
  UserProfile, 
  Household, 
  Item, 
  Transaction, 
  Session,
  ErrorCode 
} from '../../types/shared';

/**
 * Export data structure
 */
interface ExportData {
  exportedAt: string;
  userId: string;
  email: string;
  profile: Partial<UserProfile>;
  households: Array<{
    householdId: string;
    householdName: string;
    role: string;
    joinedAt: string;
  }>;
  items: Partial<Item>[];
  transactions: Partial<Transaction>[];
  auditLogs: Array<{
    timestamp: string;
    eventType: string;
    eventData: any;
  }>;
  sessions: Partial<Session>[];
  dataDictionary: {
    profile: string;
    households: string;
    items: string;
    transactions: string;
    auditLogs: string;
    sessions: string;
  };
}

/**
 * Export all user data for GDPR compliance
 * 
 * @param request - HTTP request
 * @param context - Function invocation context
 * @returns JSON file with all user data
 */
async function exportData(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Validate JWT token
  const authContext = await validateJWT(request, context);
  if (!authContext) {
    return createErrorResponse(
      ErrorCode.AUTH_INVALID,
      'Invalid or missing authentication token',
      401
    );
  }

  const startTime = Date.now();
  context.info(`Data export requested by user ${authContext.userId}`);

  try {
    // Get Cosmos DB service
    const cosmosService = await getCosmosDbService();

    // Collect data from all containers
    const exportData: ExportData = {
      exportedAt: new Date().toISOString(),
      userId: authContext.userId,
      email: authContext.email,
      profile: {},
      households: [],
      items: [],
      transactions: [],
      auditLogs: [],
      sessions: [],
      dataDictionary: {
        profile: 'User profile information including display name, preferences, timezone, and currency settings',
        households: 'List of households the user is a member of, including role and join date',
        items: 'Inventory items from all households the user belongs to',
        transactions: 'Purchase history for all items in user\'s households',
        auditLogs: 'Audit trail of user actions (90-day retention)',
        sessions: 'Active login sessions across all devices'
      }
    };

    // 1. Export user profile
    const usersContainer = cosmosService.getUsersContainer();
    try {
      const { resource: userProfile } = await usersContainer
        .item(authContext.userId, authContext.userId)
        .read<UserProfile>();
      
      if (userProfile) {
        // Exclude internal fields
        const { _etag, ...profileData } = userProfile;
        exportData.profile = profileData;
      }
    } catch (error: any) {
      context.warn('User profile not found (may be new user):', error);
    }

    // 2. Export household memberships
    const householdsContainer = cosmosService.getHouseholdsContainer();
    const userHouseholdIds = authContext.householdIds || [];
    
    for (const householdId of userHouseholdIds) {
      try {
        const { resource: household } = await householdsContainer
          .item(householdId, householdId)
          .read<Household>();
        
        if (household) {
          const member = household.members.find(m => m.userId === authContext.userId);
          if (member) {
            exportData.households.push({
              householdId: household.id,
              householdName: household.name,
              role: member.role,
              joinedAt: member.joinedAt,
            });
          }
        }
      } catch (error: any) {
        context.warn(`Failed to fetch household ${householdId}:`, error);
      }
    }

    // 3. Export items from all user's households
    const itemsContainer = cosmosService.getItemsContainer();
    for (const householdId of userHouseholdIds) {
      try {
        const { resources: items } = await itemsContainer.items
          .query<Item>({
            query: 'SELECT * FROM c WHERE c.householdId = @householdId',
            parameters: [{ name: '@householdId', value: householdId }]
          })
          .fetchAll();
        
        // Exclude internal fields
        const cleanedItems = items.map(({ _etag, ...item }) => item);
        exportData.items.push(...cleanedItems);
      } catch (error: any) {
        context.warn(`Failed to fetch items for household ${householdId}:`, error);
      }
    }

    // 4. Export transactions from all user's households
    const transactionsContainer = cosmosService.getTransactionsContainer();
    for (const householdId of userHouseholdIds) {
      try {
        const { resources: transactions } = await transactionsContainer.items
          .query<Transaction>({
            query: 'SELECT * FROM c WHERE c.householdId = @householdId',
            parameters: [{ name: '@householdId', value: householdId }]
          })
          .fetchAll();
        
        // Exclude internal fields
        const cleanedTransactions = transactions.map(({ _etag, ...transaction }) => transaction);
        exportData.transactions.push(...cleanedTransactions);
      } catch (error: any) {
        context.warn(`Failed to fetch transactions for household ${householdId}:`, error);
      }
    }

    // 5. Export audit logs (user's own actions)
    const eventsContainer = cosmosService.getEventsContainer();
    try {
      const { resources: auditEvents } = await eventsContainer.items
        .query({
          query: 'SELECT * FROM c WHERE c.userId = @userId AND c.type = @type',
          parameters: [
            { name: '@userId', value: authContext.userId },
            { name: '@type', value: 'audit_log' }
          ]
        })
        .fetchAll();
      
      exportData.auditLogs = auditEvents.map((event: any) => ({
        timestamp: event.timestamp,
        eventType: event.eventType,
        eventData: event.eventData,
      }));
    } catch (error: any) {
      context.warn('Failed to fetch audit logs:', error);
    }

    // 6. Export active sessions
    const sessionsContainer = cosmosService.getSessionsContainer();
    try {
      const { resources: sessions } = await sessionsContainer.items
        .query<Session>({
          query: 'SELECT * FROM c WHERE c.userId = @userId AND c.type = @type',
          parameters: [
            { name: '@userId', value: authContext.userId },
            { name: '@type', value: 'session' }
          ]
        })
        .fetchAll();
      
      // Exclude internal fields
      const cleanedSessions = sessions.map(({ _etag, ...session }) => session);
      exportData.sessions.push(...cleanedSessions);
    } catch (error: any) {
      context.warn('Failed to fetch sessions:', error);
    }

    // Calculate export size (approximate)
    const exportJson = JSON.stringify(exportData, null, 2);
    const exportSizeMB = exportJson.length / (1024 * 1024);
    
    context.info(`Data export completed: ${exportSizeMB.toFixed(2)} MB`);
    context.info(`Items: ${exportData.items.length}, Transactions: ${exportData.transactions.length}, Sessions: ${exportData.sessions.length}`);

    // Warn if export is too large (>10MB)
    if (exportSizeMB > 10) {
      context.warn(`Export size exceeds 10MB: ${exportSizeMB.toFixed(2)} MB. Consider async processing.`);
    }

    // Log audit event
    const now = new Date().toISOString();
    const auditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'audit_log',
      userId: authContext.userId,
      householdId: authContext.householdIds[0] || 'none',
      eventType: 'DATA_EXPORT',
      eventData: {
        exportSizeMB: exportSizeMB.toFixed(2),
        itemCount: exportData.items.length,
        transactionCount: exportData.transactions.length,
        sessionCount: exportData.sessions.length,
        householdCount: exportData.households.length,
      },
      timestamp: now,
      ttl: 7776000, // 90 days retention for audit logs
    };

    try {
      await eventsContainer.items.create(auditEvent);
      context.info('Audit event logged: DATA_EXPORT');
    } catch (error) {
      // Non-critical error - log but don't fail the request
      context.error('Failed to log audit event (non-critical):', error);
    }

    // Performance logging
    const elapsedTime = Date.now() - startTime;
    context.info(`Data export completed in ${elapsedTime}ms`);

    if (elapsedTime > 5000) {
      context.warn(`Export took longer than 5 seconds: ${elapsedTime}ms. Consider async processing for large datasets.`);
    }

    // Set response headers for file download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `kirana-data-${authContext.userId}-${timestamp}.json`;

    return {
      status: 200,
      body: exportJson,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    };

  } catch (error: any) {
    context.error('Error exporting user data:', error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to export data. Please try again or contact support.',
      500
    );
  }
}

/**
 * Create error response
 */
function createErrorResponse(code: ErrorCode, message: string, status: number): HttpResponseInit {
  const response: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message
    }
  };

  return {
    status,
    jsonBody: response,
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

// Register route
app.http('users-exportData', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'users/me/export',
  handler: exportData
});
