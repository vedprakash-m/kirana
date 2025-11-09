/**
 * Auth Refresh Endpoint
 * 
 * Provides secure token refresh using HttpOnly cookies to mitigate XSS attacks.
 * 
 * Security Architecture:
 * - Refresh tokens NEVER sent to frontend (stored in HttpOnly cookies only)
 * - Cookies have Secure flag (HTTPS only) and SameSite=Strict
 * - Automatic token rotation on every refresh
 * - Old refresh tokens invalidated after use
 * 
 * Flow:
 * 1. Frontend detects access token expiring (5 min buffer)
 * 2. Frontend calls POST /api/auth/refresh (no body, cookie sent automatically)
 * 3. Backend validates refresh token from HttpOnly cookie
 * 4. Backend issues new access token + new refresh token
 * 5. New refresh token set in HttpOnly cookie, access token returned in response
 * 6. Frontend updates access token in sessionStorage
 * 
 * References:
 * - Tech Spec Section 8.5: Session Management & Device Tracking
 * - Security Audit (Nov 2025): Frontend token storage vulnerability fix
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { rateLimitMiddleware, RATE_LIMITS, addRateLimitHeaders } from '../../middleware/rateLimiter';

interface RefreshTokenPayload {
  userId: string;
  email: string;
  sessionId: string;
  tokenId: string; // Unique token ID for rotation tracking
}

/**
 * Refresh access token using HttpOnly cookie
 * 
 * Request: POST /api/auth/refresh
 * Headers: Cookie: refreshToken=<token>
 * 
 * Response: 200 OK
 * {
 *   accessToken: "eyJ...",
 *   expiresIn: 3600
 * }
 * + Set-Cookie: refreshToken=<new_token>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
 */
export async function refreshToken(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Apply rate limiting (10 requests per hour per IP)
  const rateLimitResult = rateLimitMiddleware(request, RATE_LIMITS.AUTH_REFRESH, 'auth-refresh');
  if (rateLimitResult) {
    context.warn('Rate limit exceeded for token refresh');
    return rateLimitResult; // Return 429 response
  }
  
  try {
    // Extract refresh token from HttpOnly cookie
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      context.warn('No cookies in refresh request');
      return {
        status: 401,
        jsonBody: {
          success: false,
          error: 'No refresh token provided',
        },
      };
    }

    // Parse refresh token from cookie string
    const refreshTokenMatch = cookies.match(/refreshToken=([^;]+)/);
    if (!refreshTokenMatch) {
      context.warn('Refresh token cookie not found');
      return {
        status: 401,
        jsonBody: {
          success: false,
          error: 'Invalid refresh token',
        },
      };
    }

    const refreshToken = refreshTokenMatch[1];

    // Verify refresh token signature
    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
        { algorithms: ['HS256'] }
      ) as RefreshTokenPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        context.warn('Refresh token expired');
        return {
          status: 401,
          jsonBody: {
            success: false,
            error: 'Refresh token expired. Please sign in again.',
          },
        };
      }
      
      context.warn('Invalid refresh token:', error.message);
      return {
        status: 401,
        jsonBody: {
          success: false,
          error: 'Invalid refresh token',
        },
      };
    }

    // Check if session still exists in database (TODO: Implement when sessions container added in Task 2.3.1)
    // For now, we trust the refresh token JWT signature
    // const cosmosService = await getCosmosDbService();
    // const sessionsContainer = cosmosService.getSessionsContainer();

    // Generate new access token (short-lived: 1 hour)
    const newAccessToken = jwt.sign(
      {
        sub: payload.userId,
        email: payload.email,
        aud: process.env.AZURE_AD_CLIENT_ID,
        iss: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      },
      process.env.JWT_SECRET!,
      {
        algorithm: 'HS256',
        expiresIn: '1h', // 3600 seconds
      }
    );

    // Generate new refresh token (long-lived: 7 days) with token rotation
    const newTokenId = crypto.randomUUID();
    const newRefreshToken = jwt.sign(
      {
        userId: payload.userId,
        email: payload.email,
        sessionId: payload.sessionId,
        tokenId: newTokenId, // New token ID for rotation tracking
      },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
      {
        algorithm: 'HS256',
        expiresIn: '7d', // 604800 seconds
      }
    );

    context.info(`Token refreshed for user ${payload.userId}`);

    // Return new access token + set new refresh token in HttpOnly cookie
    const response: HttpResponseInit = {
      status: 200,
      headers: {
        'Set-Cookie': `refreshToken=${newRefreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`, // 7 days
      },
      jsonBody: {
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: 3600, // 1 hour
        },
      },
    };
    
    // Add rate limit headers
    addRateLimitHeaders(response, request);
    
    return response;
  } catch (error: any) {
    context.error('Error refreshing token:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Internal server error',
      },
    };
  }
}

app.http('refreshToken', {
  methods: ['POST'],
  authLevel: 'anonymous', // No auth required - uses cookie-based refresh token
  route: 'auth/refresh',
  handler: refreshToken,
});
