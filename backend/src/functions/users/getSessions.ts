/**
 * User Sessions API - GET /api/users/me/sessions
 * 
 * Purpose: List all active sessions for current user
 * 
 * This endpoint allows users to view all their active sessions across
 * different devices for security and device management purposes.
 * 
 * Security:
 * - Requires valid JWT token
 * - Users can only view their own sessions (filtered by userId)
 * - Current session is marked with isCurrent flag
 * 
 * Use Cases:
 * - Security audit: See where you're logged in
 * - Device management: Identify unfamiliar devices
 * - Multi-device awareness: Know which devices are active
 * 
 * Session Detection:
 * - Current session identified by sessionId in JWT claims (if available)
 * - Fallback to IP address matching (less reliable due to NAT/proxies)
 * - Sessions sorted by lastActivityAt (most recent first)
 * 
 * Data Privacy:
 * - Only shows user's own sessions
 * - IP addresses shown in full (not hashed) for security auditing
 * - Device info extracted from user-agent strings
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateJWT } from '../../middleware/auth';
import { getCosmosDbService } from '../../services/cosmosDbService';
import { ApiResponse, Session, ErrorCode } from '../../types/shared';

/**
 * Session response interface (subset of full Session type)
 */
interface SessionResponse {
  id: string;
  deviceInfo: {
    os: string;
    browser: string;
    userAgent: string;
  };
  ipAddress: string;
  location?: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

interface GetSessionsResponse {
  sessions: SessionResponse[];
  totalCount: number;
  activeCount: number;
}

/**
 * Get all active sessions for current user
 * 
 * @param request - HTTP request
 * @param context - Function invocation context
 * @returns List of active sessions with device info
 */
async function getSessions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

    // Filter out expired sessions
    const now = new Date();
    const activeSessions = allSessions.filter(session => {
      const expiresAt = new Date(session.expiresAt);
      return expiresAt > now;
    });

    // Get current session identifier
    // Try to get sessionId from JWT claims first (if we store it there)
    // Otherwise, fall back to IP address matching
    const currentSessionId = (authContext as any).sessionId; // May be undefined
    const currentIpAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                            request.headers.get('x-real-ip') || 
                            'unknown';

    context.info(`Found ${activeSessions.length} active sessions for user ${authContext.userId}`);
    context.info(`Current session detection: sessionId=${currentSessionId}, IP=${currentIpAddress}`);

    // Map sessions to response format and mark current session
    const sessionResponses: SessionResponse[] = activeSessions.map(session => {
      // Determine if this is the current session
      // Priority: sessionId match > IP address match
      let isCurrent = false;
      
      if (currentSessionId) {
        isCurrent = session.id === currentSessionId;
      } else if (currentIpAddress !== 'unknown') {
        // Fallback to IP matching (less reliable)
        isCurrent = session.ipAddress === currentIpAddress;
      }

      return {
        id: session.id,
        deviceInfo: {
          os: session.deviceInfo.os,
          browser: session.deviceInfo.browser,
          userAgent: session.deviceInfo.userAgent,
        },
        ipAddress: session.ipAddress,
        location: session.location,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        expiresAt: session.expiresAt,
        isCurrent,
      };
    });

    // Sort by lastActivityAt descending (most recent first)
    sessionResponses.sort((a, b) => {
      const dateA = new Date(a.lastActivityAt).getTime();
      const dateB = new Date(b.lastActivityAt).getTime();
      return dateB - dateA; // Descending order
    });

    // Ensure current session is always first (if detected)
    const currentSessionIndex = sessionResponses.findIndex(s => s.isCurrent);
    if (currentSessionIndex > 0) {
      // Move current session to front
      const [currentSession] = sessionResponses.splice(currentSessionIndex, 1);
      sessionResponses.unshift(currentSession);
    }

    // Build response
    const response: GetSessionsResponse = {
      sessions: sessionResponses,
      totalCount: allSessions.length, // Includes expired
      activeCount: activeSessions.length,
    };

    return createSuccessResponse(response);

  } catch (error: any) {
    context.error('Error fetching user sessions:', error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to retrieve sessions. Please try again.',
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
app.http('users-getSessions', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'users/me/sessions',
  handler: getSessions
});
