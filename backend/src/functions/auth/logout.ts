/**
 * Auth Logout Endpoint
 * 
 * Handles user logout by clearing refresh token cookie and optionally deleting session.
 * 
 * Security Features:
 * - Rate limiting: 20 attempts per hour per IP (generous for legitimate logout actions)
 * - Clears HttpOnly refresh token cookie
 * - Deletes session from database (when sessions container implemented)
 * - Audit logging for security tracking
 * 
 * Flow:
 * 1. Frontend calls POST /api/auth/logout
 * 2. Backend validates JWT (if present)
 * 3. Clears refresh token cookie
 * 4. Deletes session from database
 * 5. Logs logout event
 * 
 * References:
 * - Tech Spec Section 8.1: Authentication & Authorization
 * - Tech Spec Section 8.5: Session Management & Device Tracking
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateJWT } from '../../middleware/auth';
import { rateLimitMiddleware, RATE_LIMITS, addRateLimitHeaders } from '../../middleware/rateLimiter';
import { logAuditEvent, AuditEventType } from '../../services/auditLogger';

/**
 * Logout endpoint - clears session and revokes tokens
 * 
 * Request: POST /api/auth/logout
 * Headers: Authorization: Bearer <access_token> (optional)
 * 
 * Response: 200 OK
 * {
 *   success: true,
 *   message: "Logged out successfully"
 * }
 * + Set-Cookie: refreshToken=; Max-Age=0 (clears cookie)
 */
export async function logout(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Apply rate limiting (20 attempts per hour per IP - generous for legitimate logouts)
  const rateLimitResult = rateLimitMiddleware(request, RATE_LIMITS.AUTH_LOGOUT, 'auth-logout');
  if (rateLimitResult) {
    context.warn('Rate limit exceeded for logout');
    return rateLimitResult; // Return 429 response
  }

  try {
    // Try to validate JWT (optional - logout should work even with expired/invalid token)
    const authContext = await validateJWT(request, context);
    
    if (authContext) {
      // User is authenticated - log logout event
      await logAuditEvent({
        eventType: AuditEventType.SESSION_EXPIRED, // Using existing event type for logout
        userId: authContext.userId,
        metadata: { email: authContext.email, reason: 'User logout' },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        success: true,
      }, context);

      // TODO: Delete session from database (Task 2.3.1 - sessions container)
      // For now, session deletion is deferred until sessions container is implemented
      // const cosmosService = await getCosmosDbService();
      // const sessionsContainer = cosmosService.getSessionsContainer();
      // 
      // // Find and delete all sessions for this user (or specific session if sessionId available)
      // const query = {
      //   query: 'SELECT c.id FROM c WHERE c.userId = @userId',
      //   parameters: [{ name: '@userId', value: authContext.userId }]
      // };
      // const { resources } = await sessionsContainer.items.query(query).fetchAll();
      // 
      // for (const session of resources) {
      //   await sessionsContainer.item(session.id, authContext.userId).delete();
      // }

      context.info(`User logged out: ${authContext.userId} (${authContext.email})`);
    } else {
      // No valid JWT - still clear cookie (logout should always succeed)
      context.info('Logout without valid JWT - clearing cookie');
    }

    // Clear refresh token cookie (set Max-Age to 0)
    const response: HttpResponseInit = {
      status: 200,
      headers: {
        'Set-Cookie': 'refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
      },
      jsonBody: {
        success: true,
        message: 'Logged out successfully',
      },
    };

    // Add rate limit headers
    addRateLimitHeaders(response, request);

    return response;
  } catch (error: any) {
    context.error('Logout error:', error);
    
    // Even on error, return success and clear cookie (logout should be fail-safe)
    return {
      status: 200,
      headers: {
        'Set-Cookie': 'refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
      },
      jsonBody: {
        success: true,
        message: 'Logged out successfully',
      },
    };
  }
}

app.http('logout', {
  methods: ['POST'],
  authLevel: 'anonymous', // No strict auth required for logout (fail-safe)
  route: 'auth/logout',
  handler: logout,
});
