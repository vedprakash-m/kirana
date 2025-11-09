/**
 * Audit Logging Service
 * 
 * Comprehensive audit logging for GDPR compliance and security monitoring.
 * All audit logs are stored in Cosmos DB 'events' container with 90-day TTL.
 * 
 * Key Features:
 * - Non-blocking writes (doesn't impact request latency)
 * - Automatic TTL-based retention (90 days)
 * - Structured event types for analytics
 * - IP address and user agent tracking
 * - GDPR compliance (data access, modification, deletion events)
 * 
 * Usage:
 * ```typescript
 * import { logAuditEvent } from '../services/auditLogger';
 * 
 * await logAuditEvent({
 *   eventType: 'ITEM_CREATED',
 *   userId: authContext.userId,
 *   householdId,
 *   resourceId: item.id,
 *   metadata: { itemName: item.name, category: item.category },
 *   ipAddress: req.headers.get('x-forwarded-for'),
 *   userAgent: req.headers.get('user-agent')
 * }, context);
 * ```
 */

import { InvocationContext } from '@azure/functions';
import { getCosmosDbService } from './cosmosDbService';

/**
 * Audit event types
 * Categorized by security, data access, and user actions
 */
export enum AuditEventType {
  // Authentication & Authorization
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  ACCESS_DENIED = 'ACCESS_DENIED',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SIGN_OUT_ALL_DEVICES = 'SIGN_OUT_ALL_DEVICES',
  
  // Data Access (GDPR Compliance)
  ITEM_ACCESSED = 'ITEM_ACCESSED',
  ITEM_LIST_ACCESSED = 'ITEM_LIST_ACCESSED',
  TRANSACTION_ACCESSED = 'TRANSACTION_ACCESSED',
  USER_PROFILE_ACCESSED = 'USER_PROFILE_ACCESSED',
  DATA_EXPORT = 'DATA_EXPORT',
  
  // Data Modification
  ITEM_CREATED = 'ITEM_CREATED',
  ITEM_UPDATED = 'ITEM_UPDATED',
  ITEM_DELETED = 'ITEM_DELETED',
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  USER_PROFILE_UPDATED = 'USER_PROFILE_UPDATED',
  
  // Critical Actions
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  HOUSEHOLD_CREATED = 'HOUSEHOLD_CREATED',
  HOUSEHOLD_MEMBER_ADDED = 'HOUSEHOLD_MEMBER_ADDED',
  HOUSEHOLD_MEMBER_REMOVED = 'HOUSEHOLD_MEMBER_REMOVED',
  INVITATION_SENT = 'INVITATION_SENT',
  INVITATION_ACCEPTED = 'INVITATION_ACCEPTED',
  
  // Admin Actions
  ADMIN_ACTION = 'ADMIN_ACTION',
  ROLE_CHANGED = 'ROLE_CHANGED',
  COST_LIMIT_EXCEEDED = 'COST_LIMIT_EXCEEDED',
  
  // System Events
  PREDICTION_CALCULATED = 'PREDICTION_CALCULATED',
  PREDICTION_OVERRIDDEN = 'PREDICTION_OVERRIDDEN',
  CSV_IMPORTED = 'CSV_IMPORTED',
  RECEIPT_PARSED = 'RECEIPT_PARSED',
  LLM_API_CALL = 'LLM_API_CALL',
}

/**
 * Audit event structure
 */
export interface AuditEvent {
  /** Event type from AuditEventType enum */
  eventType: AuditEventType;
  
  /** Timestamp (ISO 8601 format) */
  timestamp?: string;
  
  /** User ID performing the action (if authenticated) */
  userId?: string;
  
  /** Household ID (if action is household-specific) */
  householdId?: string;
  
  /** Resource ID being accessed/modified (item ID, transaction ID, etc.) */
  resourceId?: string;
  
  /** Additional metadata (flexible JSON object) */
  metadata?: Record<string, any>;
  
  /** IP address of the request */
  ipAddress?: string;
  
  /** User agent of the request */
  userAgent?: string;
  
  /** Success/failure indicator */
  success?: boolean;
  
  /** Error details (if failed) */
  error?: string;
  
  /** Custom TTL in seconds (default: 90 days = 7776000) */
  ttl?: number;
}

/**
 * Log an audit event to Cosmos DB
 * 
 * This function is non-blocking - it fires and forgets the write operation
 * to avoid impacting request latency. Errors are logged but don't throw.
 * 
 * @param event - Audit event details
 * @param context - Function invocation context for logging
 */
export async function logAuditEvent(
  event: AuditEvent,
  context: InvocationContext
): Promise<void> {
  try {
    const cosmosService = await getCosmosDbService();
    const container = cosmosService.getEventsContainer();
    
    const auditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'audit_log',
      eventType: event.eventType,
      timestamp: event.timestamp || new Date().toISOString(),
      userId: event.userId,
      householdId: event.householdId,
      resourceId: event.resourceId,
      metadata: event.metadata || {},
      ipAddress: event.ipAddress || 'unknown',
      userAgent: event.userAgent || 'unknown',
      success: event.success !== undefined ? event.success : true,
      error: event.error,
      ttl: event.ttl || 7776000, // Default: 90 days
    };
    
    // Non-blocking write (don't await)
    container.items.create(auditLog).catch(err => {
      context.error('Failed to write audit log:', err);
    });
    
    context.trace(`Audit event logged: ${event.eventType}`);
  } catch (error: any) {
    context.error('Error logging audit event:', error);
    // Don't throw - audit logging failures should never break the main flow
  }
}

/**
 * Query audit logs for a specific user
 * Used for GDPR data export and user activity review
 * 
 * @param userId - User ID to query logs for
 * @param context - Function invocation context
 * @param startDate - Optional start date filter (ISO 8601)
 * @param endDate - Optional end date filter (ISO 8601)
 * @param eventTypes - Optional array of event types to filter by
 * @returns Array of audit log entries
 */
export async function getAuditLogsForUser(
  userId: string,
  context: InvocationContext,
  options?: {
    startDate?: string;
    endDate?: string;
    eventTypes?: AuditEventType[];
    limit?: number;
  }
): Promise<any[]> {
  try {
    const cosmosService = await getCosmosDbService();
    const container = cosmosService.getEventsContainer();
    
    // Build query
    let query = 'SELECT * FROM c WHERE c.type = "audit_log" AND c.userId = @userId';
    const parameters = [{ name: '@userId', value: userId }];
    
    // Add date filters if provided
    if (options?.startDate) {
      query += ' AND c.timestamp >= @startDate';
      parameters.push({ name: '@startDate', value: options.startDate });
    }
    
    if (options?.endDate) {
      query += ' AND c.timestamp <= @endDate';
      parameters.push({ name: '@endDate', value: options.endDate });
    }
    
    // Add event type filter if provided
    if (options?.eventTypes && options.eventTypes.length > 0) {
      query += ' AND c.eventType IN (' + options.eventTypes.map((_, i) => `@eventType${i}`).join(', ') + ')';
      options.eventTypes.forEach((eventType, i) => {
        parameters.push({ name: `@eventType${i}`, value: eventType });
      });
    }
    
    // Add ordering and limit
    query += ' ORDER BY c.timestamp DESC';
    
    const querySpec = {
      query,
      parameters,
    };
    
    const { resources } = await container.items
      .query(querySpec, { maxItemCount: options?.limit || 1000 })
      .fetchAll();
    
    context.info(`Retrieved ${resources.length} audit logs for user ${userId}`);
    return resources;
  } catch (error: any) {
    context.error('Error querying audit logs:', error);
    return [];
  }
}

/**
 * Query audit logs for a specific household
 * Used for household-level activity monitoring
 * 
 * @param householdId - Household ID to query logs for
 * @param context - Function invocation context
 * @param options - Query options (date range, event types, limit)
 * @returns Array of audit log entries
 */
export async function getAuditLogsForHousehold(
  householdId: string,
  context: InvocationContext,
  options?: {
    startDate?: string;
    endDate?: string;
    eventTypes?: AuditEventType[];
    limit?: number;
  }
): Promise<any[]> {
  try {
    const cosmosService = await getCosmosDbService();
    const container = cosmosService.getEventsContainer();
    
    // Build query
    let query = 'SELECT * FROM c WHERE c.type = "audit_log" AND c.householdId = @householdId';
    const parameters = [{ name: '@householdId', value: householdId }];
    
    // Add date filters if provided
    if (options?.startDate) {
      query += ' AND c.timestamp >= @startDate';
      parameters.push({ name: '@startDate', value: options.startDate });
    }
    
    if (options?.endDate) {
      query += ' AND c.timestamp <= @endDate';
      parameters.push({ name: '@endDate', value: options.endDate });
    }
    
    // Add event type filter if provided
    if (options?.eventTypes && options.eventTypes.length > 0) {
      query += ' AND c.eventType IN (' + options.eventTypes.map((_, i) => `@eventType${i}`).join(', ') + ')';
      options.eventTypes.forEach((eventType, i) => {
        parameters.push({ name: `@eventType${i}`, value: eventType });
      });
    }
    
    // Add ordering and limit
    query += ' ORDER BY c.timestamp DESC';
    
    const querySpec = {
      query,
      parameters,
    };
    
    const { resources } = await container.items
      .query(querySpec, { maxItemCount: options?.limit || 1000 })
      .fetchAll();
    
    context.info(`Retrieved ${resources.length} audit logs for household ${householdId}`);
    return resources;
  } catch (error: any) {
    context.error('Error querying audit logs:', error);
    return [];
  }
}

/**
 * Delete audit logs for a specific user (GDPR right to be forgotten)
 * Called during account deletion to remove user's audit trail
 * 
 * Note: Some logs may be retained for legal/compliance reasons even after user deletion
 * 
 * @param userId - User ID to delete logs for
 * @param context - Function invocation context
 * @returns Number of logs deleted
 */
export async function deleteAuditLogsForUser(
  userId: string,
  context: InvocationContext
): Promise<number> {
  try {
    const cosmosService = await getCosmosDbService();
    const container = cosmosService.getEventsContainer();
    
    // Query all audit logs for the user
    const query = {
      query: 'SELECT c.id FROM c WHERE c.type = "audit_log" AND c.userId = @userId',
      parameters: [{ name: '@userId', value: userId }],
    };
    
    const { resources } = await container.items.query(query).fetchAll();
    
    // Delete all logs
    let deletedCount = 0;
    for (const log of resources) {
      try {
        await container.item(log.id, userId).delete();
        deletedCount++;
      } catch (error: any) {
        context.warn(`Failed to delete audit log ${log.id}:`, error.message);
      }
    }
    
    context.info(`Deleted ${deletedCount} audit logs for user ${userId}`);
    return deletedCount;
  } catch (error: any) {
    context.error('Error deleting audit logs:', error);
    return 0;
  }
}

/**
 * Helper: Log authentication success
 */
export async function logAuthSuccess(
  userId: string,
  email: string,
  ipAddress: string,
  userAgent: string,
  context: InvocationContext
): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.AUTH_SUCCESS,
    userId,
    metadata: { email },
    ipAddress,
    userAgent,
    success: true,
  }, context);
}

/**
 * Helper: Log data export (GDPR compliance)
 */
export async function logDataExport(
  userId: string,
  exportSize: number,
  ipAddress: string,
  userAgent: string,
  context: InvocationContext
): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.DATA_EXPORT,
    userId,
    metadata: { exportSizeBytes: exportSize },
    ipAddress,
    userAgent,
    success: true,
  }, context);
}

/**
 * Helper: Log account deletion (GDPR compliance)
 */
export async function logAccountDeletion(
  userId: string,
  metadata: {
    itemsDeleted: number;
    transactionsDeleted: number;
    householdsLeft: number;
  },
  ipAddress: string,
  userAgent: string,
  context: InvocationContext
): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.ACCOUNT_DELETED,
    userId,
    metadata,
    ipAddress,
    userAgent,
    success: true,
    ttl: 7776000, // Keep for 90 days even after account deletion
  }, context);
}

/**
 * Helper: Log LLM API call for cost tracking
 */
export async function logLLMApiCall(
  userId: string | undefined,
  operation: string,
  tokenCount: number,
  cost: number,
  context: InvocationContext
): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.LLM_API_CALL,
    userId,
    metadata: {
      operation,
      tokenCount,
      cost,
      model: 'gemini-2.5-flash',
    },
    success: true,
    ttl: 2592000, // 30 days for cost tracking
  }, context);
}
