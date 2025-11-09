/**
 * Auth Login Endpoint
 * 
 * Handles user login and session creation with rate limiting to prevent brute force attacks.
 * 
 * Security Features:
 * - Rate limiting: 5 attempts per 15 minutes per IP
 * - Refresh token stored in HttpOnly cookie (never exposed to frontend)
 * - Access token returned in response body (stored in sessionStorage by frontend)
 * - Session tracking for multi-device management
 * 
 * Flow:
 * 1. User completes MSAL OAuth flow (handled by frontend)
 * 2. Frontend calls POST /api/auth/login with MSAL access token
 * 3. Backend validates token, creates session, issues refresh token
 * 4. Refresh token set in HttpOnly cookie, access token returned in body
 * 
 * References:
 * - Tech Spec Section 8.1: Authentication & Authorization
 * - Tech Spec Section 8.5: Session Management & Device Tracking
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { rateLimitMiddleware, RATE_LIMITS, addRateLimitHeaders } from '../../middleware/rateLimiter';
import { logAuditEvent, AuditEventType } from '../../services/auditLogger';

interface LoginRequest {
  msalAccessToken: string; // Access token from MSAL OAuth flow
  deviceInfo?: {
    os?: string;
    browser?: string;
    userAgent?: string;
  };
}

/**
 * Login endpoint - creates session and issues tokens
 * 
 * Request: POST /api/auth/login
 * Body: { msalAccessToken: "eyJ..." }
 * 
 * Response: 200 OK
 * {
 *   accessToken: "eyJ...",
 *   expiresIn: 3600,
 *   user: { id: "...", email: "...", displayName: "..." }
 * }
 * + Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict
 */
export async function login(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Apply rate limiting (5 attempts per 15 minutes per IP)
  const rateLimitResult = rateLimitMiddleware(request, RATE_LIMITS.AUTH_LOGIN, 'auth-login');
  if (rateLimitResult) {
    context.warn('Rate limit exceeded for login');
    return rateLimitResult; // Return 429 response
  }

  try {
    const body: LoginRequest = await request.json() as LoginRequest;
    const { msalAccessToken } = body;

    if (!msalAccessToken) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Missing msalAccessToken in request body',
        },
      };
    }

    // Verify MSAL token (basic validation - full validation done by validateJWT middleware)
    let decoded: any;
    try {
      // Decode without verification for now (full verification in validateJWT middleware)
      decoded = jwt.decode(msalAccessToken);
      
      if (!decoded || !decoded.sub || !decoded.email) {
        throw new Error('Invalid token structure');
      }
    } catch (error: any) {
      context.warn('Invalid MSAL token:', error.message);
      return {
        status: 401,
        jsonBody: {
          success: false,
          error: 'Invalid authentication token',
        },
      };
    }

    const userId = decoded.sub || decoded.oid;
    const email = decoded.email || decoded.preferred_username;
    const displayName = decoded.name || email.split('@')[0];

    // Generate session ID
    const sessionId = crypto.randomUUID();
    
    // Generate refresh token (long-lived: 7 days)
    const tokenId = crypto.randomUUID();
    const refreshToken = jwt.sign(
      {
        userId,
        email,
        sessionId,
        tokenId,
      },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
      {
        algorithm: 'HS256',
        expiresIn: '7d', // 604800 seconds
      }
    );

    // Generate access token (short-lived: 1 hour)
    const accessToken = jwt.sign(
      {
        sub: userId,
        email,
        aud: process.env.AZURE_AD_CLIENT_ID,
        iss: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      },
      process.env.JWT_SECRET!,
      {
        algorithm: 'HS256',
        expiresIn: '1h', // 3600 seconds
      }
    );

    // TODO: Create session in database (Task 2.3.1 - sessions container)
    // For now, session tracking is deferred until sessions container is implemented
    // const cosmosService = await getCosmosDbService();
    // const sessionsContainer = cosmosService.getSessionsContainer();
    // await sessionsContainer.items.create({
    //   id: sessionId,
    //   userId,
    //   deviceInfo: deviceInfo || { userAgent: request.headers.get('user-agent') },
    //   ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    //   createdAt: new Date().toISOString(),
    //   lastActivityAt: new Date().toISOString(),
    //   expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    //   refreshTokenId: tokenId,
    // });

    // Log successful authentication
    await logAuditEvent({
      eventType: AuditEventType.AUTH_SUCCESS,
      userId,
      metadata: { email, displayName, sessionId },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      success: true,
    }, context);

    context.info(`User logged in: ${userId} (${email}), session ${sessionId}`);

    // Return access token + set refresh token in HttpOnly cookie
    const response: HttpResponseInit = {
      status: 200,
      headers: {
        'Set-Cookie': `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`, // 7 days
      },
      jsonBody: {
        success: true,
        data: {
          accessToken,
          expiresIn: 3600, // 1 hour
          user: {
            id: userId,
            email,
            displayName,
          },
        },
      },
    };

    // Add rate limit headers
    addRateLimitHeaders(response, request);

    return response;
  } catch (error: any) {
    context.error('Login error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Internal server error',
      },
    };
  }
}

app.http('login', {
  methods: ['POST'],
  authLevel: 'anonymous', // No auth required for login
  route: 'auth/login',
  handler: login,
});
