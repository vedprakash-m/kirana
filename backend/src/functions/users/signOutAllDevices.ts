/**
 * Sign Out All Devices API - DELETE /api/users/me/sessions
 * 
 * Purpose: Sign out from all sessions except the current one
 * 
 * This endpoint is a critical security feature that allows users to
 * invalidate all their active sessions across all devices except the
 * current session. This is useful when:
 * - User suspects their account has been compromised
 * - User wants to revoke access from lost/stolen devices
 * - User wants to force re-authentication on all other devices
 * 
 * Security Features:
 * - Requires valid JWT token
 * - Protects current session from deletion
 * - Logs audit event for security monitoring
 * - Returns count of deleted sessions
 * 
 * Session Protection:
 * - Primary: Match sessionId from JWT claims (if available)
 * - Fallback: Match IP address from request headers
 * - Ensures user doesn't accidentally sign themselves out
 * 
 * Use Cases:
 * - Security incident response (compromised account)
 * - Device management (clean up old sessions)
 * - Privacy management (revoke access)
 * 
 * Audit Logging:
 * - Event type: SIGN_OUT_ALL_DEVICES
 * - Logged to events container with:
 *   - userId, timestamp, IP address
 *   - Number of sessions deleted
 *   - Current session details (protected)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateJWT } from '../../middleware/auth';
import { getCosmosDbService } from '../../services/cosmosDbService';
import { ApiResponse, Session, ErrorCode } from '../../types/shared';

/**
 * Response interface for sign out all devices
 */
interface SignOutAllDevicesResponse {
  sessionsDeleted: number;
  message: string;
}

/**
 * Sign out from all devices except current session
 * 
 * @param request - HTTP request
 * @param context - Function invocation context
 * @returns Count of deleted sessions
 */
async function signOutAllDevices(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Validate JWT token
  const authContext = await validateJWT(request, context);
  if (!authContext) {
    return createErrorResponse(
      ErrorCode.AUTH_INVALID,
      'Invalid or missing authentication token',
      401
    );
  }

  try {
    // Get Cosmos DB service
    const cosmosService = await getCosmosDbService();
    const sessionsContainer = cosmosService.getSessionsContainer();
    const eventsContainer = cosmosService.getEventsContainer();

    // Query all sessions for this user
    const { resources: allSessions } = await sessionsContainer.items
      .query<Session>({
        query: 'SELECT * FROM c WHERE c.userId = @userId AND c.type = @type',
        parameters: [
          { name: '@userId', value: authContext.userId },
          { name: '@type', value: 'session' }
        ]
      })
      .fetchAll();

    // Get current session identifier
    // Try to get sessionId from JWT claims first (if we store it there)
    // Otherwise, fall back to IP address matching
    const currentSessionId = (authContext as any).sessionId; // May be undefined
    const currentIpAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                            request.headers.get('x-real-ip') || 
                            'unknown';

    context.info(`Sign out all devices requested by user ${authContext.userId}`);
    context.info(`Total sessions found: ${allSessions.length}`);
    context.info(`Current session detection: sessionId=${currentSessionId}, IP=${currentIpAddress}`);

    // Identify current session
    let currentSession: Session | undefined;
    
    if (currentSessionId) {
      // Primary: Match by sessionId
      currentSession = allSessions.find(s => s.id === currentSessionId);
      if (currentSession) {
        context.info(`Current session identified by sessionId: ${currentSessionId}`);
      }
    }
    
    if (!currentSession && currentIpAddress !== 'unknown') {
      // Fallback: Match by IP address (less reliable)
      currentSession = allSessions.find(s => s.ipAddress === currentIpAddress);
      if (currentSession) {
        context.info(`Current session identified by IP address: ${currentIpAddress}`);
      }
    }

    if (!currentSession) {
      context.warn('Could not identify current session. Will delete all sessions to be safe.');
      // Note: This is a safety measure. If we can't identify the current session,
      // we delete ALL sessions (including current) to ensure security.
      // User will need to re-authenticate.
    }

    // Determine which sessions to delete
    const sessionsToDelete = currentSession 
      ? allSessions.filter(s => s.id !== currentSession!.id)
      : allSessions; // Delete all if current session not identified

    context.info(`Sessions to delete: ${sessionsToDelete.length}`);
    if (currentSession) {
      context.info(`Current session protected: ${currentSession.id}`);
    }

    // Delete sessions (batch operation for efficiency)
    let deletedCount = 0;
    const deletePromises = sessionsToDelete.map(async (session) => {
      try {
        await sessionsContainer
          .item(session.id, session.userId) // id, partitionKey
          .delete();
        deletedCount++;
        context.info(`Deleted session: ${session.id} (${session.deviceInfo.os}, ${session.deviceInfo.browser})`);
      } catch (error: any) {
        // Log but don't fail the whole operation
        context.error(`Failed to delete session ${session.id}:`, error);
      }
    });

    // Wait for all deletions to complete
    await Promise.all(deletePromises);

    // Log audit event
    const now = new Date().toISOString();
    const auditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'audit_log',
      userId: authContext.userId,
      householdId: authContext.householdIds[0] || 'none', // Use first household or 'none'
      eventType: 'SIGN_OUT_ALL_DEVICES',
      eventData: {
        totalSessions: allSessions.length,
        sessionsDeleted: deletedCount,
        currentSessionProtected: currentSession !== undefined,
        currentSessionId: currentSession?.id,
        ipAddress: currentIpAddress,
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
      timestamp: now,
      ttl: 7776000, // 90 days retention for audit logs
    };

    try {
      await eventsContainer.items.create(auditEvent);
      context.info('Audit event logged: SIGN_OUT_ALL_DEVICES');
    } catch (error) {
      // Non-critical error - log but don't fail the request
      context.error('Failed to log audit event (non-critical):', error);
    }

    // Build response
    const message = deletedCount === 0
      ? 'No other sessions to sign out'
      : deletedCount === 1
        ? 'Signed out from 1 device'
        : `Signed out from ${deletedCount} devices`;

    const response: SignOutAllDevicesResponse = {
      sessionsDeleted: deletedCount,
      message,
    };

    return createSuccessResponse(response);

  } catch (error: any) {
    context.error('Error signing out all devices:', error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to sign out from all devices. Please try again.',
      500
    );
  }
}

/**
 * Create success response with data
 */
function createSuccessResponse<T>(data: T, status: number = 200): HttpResponseInit {
  const response: ApiResponse<T> = {
    success: true,
    data
  };

  return {
    status,
    jsonBody: response,
    headers: {
      'Content-Type': 'application/json'
    }
  };
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
app.http('users-signOutAllDevices', {
  methods: ['DELETE'],
  authLevel: 'function',
  route: 'users/me/sessions',
  handler: signOutAllDevices
});
