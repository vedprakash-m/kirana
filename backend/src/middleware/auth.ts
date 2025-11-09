/**
 * Authentication & Authorization Middleware
 * 
 * Provides JWT validation and household-based authorization for all protected endpoints.
 * 
 * Security Requirements:
 * - All Azure Functions MUST use authLevel: 'function' in production (NEVER 'anonymous')
 * - JWT validation middleware MUST be first in middleware chain
 * - Household authorization MUST validate user membership before data access
 * - ALL failed authentication/authorization attempts are logged for audit
 * 
 * Usage:
 * ```typescript
 * app.http('getItems', {
 *   methods: ['GET'],
 *   authLevel: 'function', // <- REQUIRED in production
 *   handler: async (req, context) => {
 *     const authContext = await validateJWT(req, context);
 *     if (!authContext) {
 *       return { status: 401, jsonBody: { error: 'Unauthorized' } };
 *     }
 *     
 *     const householdId = authContext.householdIds[0];
 *     if (!await validateHouseholdAccess(authContext, householdId, context)) {
 *       return { status: 403, jsonBody: { error: 'Forbidden' } };
 *     }
 *     
 *     // Proceed with business logic...
 *   }
 * });
 * ```
 */

import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { getCosmosDbService } from '../services/cosmosDbService';

/**
 * Authentication context attached to request after successful JWT validation
 */
export interface AuthContext {
  /** User ID from JWT sub/oid claim */
  userId: string;
  
  /** User email from JWT email/preferred_username claim */
  email: string;
  
  /** List of household IDs the user belongs to */
  householdIds: string[];
  
  /** User roles (admin, member, etc.) from JWT roles claim */
  roles: string[];
}

/**
 * Decoded JWT payload structure from Microsoft Entra ID
 */
interface JWTPayload {
  sub?: string;
  oid?: string;
  email?: string;
  preferred_username?: string;
  roles?: string[];
  aud?: string;
  iss?: string;
  exp?: number;
}

/**
 * JWKS client for retrieving public keys from Microsoft Entra ID
 * Caches keys for 24 hours to minimize external calls
 */
const jwksClientInstance = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

/**
 * Get signing key from JWKS endpoint
 * Used by jsonwebtoken library to verify JWT signature
 */
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  jwksClientInstance.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Validate JWT token and extract authentication context
 * 
 * Steps:
 * 1. Extract token from Authorization header
 * 2. Verify token signature using Entra ID public keys (JWKS)
 * 3. Validate token claims (audience, issuer, expiry)
 * 4. Extract user info (userId, email, roles)
 * 5. Query user's households from Cosmos DB
 * 6. Return AuthContext or null if validation fails
 * 
 * @param req - HTTP request with Authorization header
 * @param context - Function invocation context for logging
 * @returns AuthContext if valid, null if invalid
 */
export async function validateJWT(
  req: HttpRequest, 
  context: InvocationContext
): Promise<AuthContext | null> {
  const authHeader = req.headers.get('authorization');
  
  // Check for Authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    context.warn('Missing or malformed Authorization header');
    await logAuthFailure(req, context, 'MISSING_TOKEN', 'Authorization header missing or malformed');
    return null;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Verify JWT signature and validate claims
    const decoded = await new Promise<JWTPayload>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: process.env.AZURE_AD_CLIENT_ID,
          issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded as JWTPayload);
          }
        }
      );
    });

    // Extract user ID (prefer 'sub' claim, fallback to 'oid')
    const userId = decoded.sub || decoded.oid;
    if (!userId) {
      context.warn('JWT missing userId claim (sub/oid)');
      await logAuthFailure(req, context, 'INVALID_CLAIMS', 'JWT missing userId claim');
      return null;
    }

    // Extract email (prefer 'email' claim, fallback to 'preferred_username')
    const email = decoded.email || decoded.preferred_username || '';

    // Extract roles (default to 'member' if not present)
    const roles = decoded.roles || ['member'];

    // Look up user's households from Cosmos DB
    const householdIds = await getUserHouseholds(userId, context);

    // Auto-create household if user has none (first-time user)
    if (householdIds.length === 0) {
      context.info(`Creating first household for new user: ${userId}`);
      const newHouseholdId = await createDefaultHousehold(userId, email, context);
      householdIds.push(newHouseholdId);
    }

    context.info(`User authenticated: ${userId} (${householdIds.length} households)`);

    return {
      userId,
      email,
      householdIds,
      roles,
    };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      context.warn('JWT token expired');
      await logAuthFailure(req, context, 'TOKEN_EXPIRED', error.message);
    } else if (error.name === 'JsonWebTokenError') {
      context.warn('Invalid JWT token:', error.message);
      await logAuthFailure(req, context, 'INVALID_TOKEN', error.message);
    } else {
      context.error('JWT validation error:', error);
      await logAuthFailure(req, context, 'VALIDATION_ERROR', error.message);
    }
    return null;
  }
}

/**
 * Query user's households from Cosmos DB
 * 
 * @param userId - User ID from JWT
 * @param context - Function invocation context
 * @returns Array of household IDs the user belongs to
 */
async function getUserHouseholds(
  userId: string,
  context: InvocationContext
): Promise<string[]> {
  try {
    const cosmosService = await getCosmosDbService();
    const container = cosmosService.getHouseholdsContainer();
    
    // Query households where user is a member
    const { resources } = await container.items
      .query({
        query: 'SELECT c.id FROM c WHERE ARRAY_CONTAINS(c.members, {"userId": @userId}, true)',
        parameters: [{ name: '@userId', value: userId }],
      })
      .fetchAll();
    
    return resources.map(h => h.id);
  } catch (error: any) {
    context.error('Error querying user households:', error);
    return [];
  }
}

/**
 * Create default household for first-time user
 * 
 * @param userId - User ID from JWT
 * @param email - User email
 * @param context - Function invocation context
 * @returns New household ID
 */
async function createDefaultHousehold(
  userId: string,
  email: string,
  context: InvocationContext
): Promise<string> {
  const cosmosService = await getCosmosDbService();
  const container = cosmosService.getHouseholdsContainer();
  
  const householdId = `household-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const household = {
    id: householdId,
    name: `${email.split('@')[0]}'s Household`,
    members: [
      {
        userId,
        email,
        role: 'admin',
        joinedAt: new Date().toISOString(),
      },
    ],
    settings: {
      currency: 'USD',
      timezone: 'America/Los_Angeles',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await container.items.create(household);
  
  context.info(`Created default household: ${householdId} for user: ${userId}`);
  
  return householdId;
}

/**
 * Validate user has access to requested household
 * 
 * Security: Prevents IDOR (Insecure Direct Object Reference) attacks
 * by ensuring authenticated user belongs to the household before
 * allowing data access.
 * 
 * @param authContext - Authenticated user context
 * @param householdId - Household ID from request
 * @param context - Function invocation context for logging
 * @returns true if authorized, false if forbidden
 */
export async function validateHouseholdAccess(
  authContext: AuthContext,
  householdId: string,
  context: InvocationContext
): Promise<boolean> {
  // Check if user belongs to requested household
  if (!authContext.householdIds.includes(householdId)) {
    context.warn(
      `AUTHORIZATION_FAILED: User ${authContext.userId} attempted to access ` +
      `household ${householdId} without permission. ` +
      `User households: [${authContext.householdIds.join(', ')}]`
    );
    
    // Log unauthorized access attempt for audit
    await logAccessDenied(
      authContext.userId,
      householdId,
      authContext.householdIds,
      context
    );
    
    return false;
  }
  
  return true;
}

/**
 * Log failed authentication attempt to audit log
 * 
 * @param req - HTTP request
 * @param context - Function invocation context
 * @param reason - Failure reason code
 * @param details - Detailed error message
 */
async function logAuthFailure(
  req: HttpRequest,
  context: InvocationContext,
  reason: string,
  details: string
): Promise<void> {
  try {
    const cosmosService = await getCosmosDbService();
    const container = cosmosService.getEventsContainer();
    
    const auditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'audit_log',
      eventType: 'AUTH_FAILED',
      timestamp: new Date().toISOString(),
      reason,
      details,
      url: req.url,
      method: req.method,
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      ttl: 7776000, // 90 days
    };
    
    // Non-blocking write (don't wait for completion)
    container.items.create(auditLog).catch(err => {
      context.error('Failed to write audit log:', err);
    });
  } catch (error: any) {
    context.error('Error logging auth failure:', error);
  }
}

/**
 * Log unauthorized household access attempt to audit log
 * 
 * @param userId - User ID attempting access
 * @param requestedHouseholdId - Household ID user tried to access
 * @param userHouseholdIds - Households user actually belongs to
 * @param context - Function invocation context
 */
async function logAccessDenied(
  userId: string,
  requestedHouseholdId: string,
  userHouseholdIds: string[],
  context: InvocationContext
): Promise<void> {
  try {
    const cosmosService = await getCosmosDbService();
    const container = cosmosService.getEventsContainer();
    
    const auditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'audit_log',
      eventType: 'ACCESS_DENIED',
      timestamp: new Date().toISOString(),
      userId,
      requestedHouseholdId,
      userHouseholdIds,
      authorized: false,
      details: 'User attempted to access household without membership',
      ttl: 7776000, // 90 days
    };
    
    // Non-blocking write
    container.items.create(auditLog).catch(err => {
      context.error('Failed to write audit log:', err);
    });
  } catch (error: any) {
    context.error('Error logging access denied:', error);
  }
}
