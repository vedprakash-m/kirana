/**
 * User Profile API - GET /api/users/me
 * 
 * Purpose: Return current authenticated user's profile
 * 
 * This endpoint provides user profile data that was auto-provisioned
 * during authentication (Phase 2.1.2). The profile is always available
 * in authContext since validateJWT() creates it on first login.
 * 
 * Security:
 * - Requires valid JWT token
 * - Returns only the authenticated user's own profile
 * - No householdId required (user-scoped resource)
 * 
 * Response includes:
 * - Basic info: id, email, displayName
 * - Settings: timezone, currency
 * - Preferences: email/push notifications, weekly digest
 * - Profile picture URL (if uploaded)
 * - Timestamps: createdAt, lastLoginAt
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateJWT } from '../../middleware/auth';
import { ApiResponse, UserProfile, ErrorCode } from '../../types/shared';

/**
 * Get current user's profile
 * 
 * @param request - HTTP request with Authorization header
 * @param context - Function invocation context
 * @returns User profile data or error response
 */
async function getProfile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // User profile is available from authContext (auto-provisioned in validateJWT)
    const userProfile = authContext.userProfile;
    
    // Sanity check: this should never happen due to auto-provisioning
    if (!userProfile) {
      context.error(`User profile missing from authContext for userId: ${authContext.userId}`);
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        'User profile not found. Please try logging in again.',
        404
      );
    }
    
    // Return profile (exclude _etag for cleaner response)
    const profileResponse: Omit<UserProfile, '_etag'> = {
      id: userProfile.id,
      type: userProfile.type,
      userId: userProfile.userId,
      email: userProfile.email,
      displayName: userProfile.displayName,
      profilePictureUrl: userProfile.profilePictureUrl,
      timezone: userProfile.timezone,
      currency: userProfile.currency,
      preferences: userProfile.preferences,
      createdAt: userProfile.createdAt,
      lastLoginAt: userProfile.lastLoginAt,
      updatedAt: userProfile.updatedAt,
    };
    
    context.info(`User profile retrieved: ${authContext.userId}`);
    
    return createSuccessResponse(profileResponse);
    
  } catch (error: any) {
    context.error('Error retrieving user profile:', error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR, 
      'Failed to retrieve user profile',
      500
    );
  }
}

/**
 * Create success response with data
 */
function createSuccessResponse<T>(data: T): HttpResponseInit {
  const response: ApiResponse<T> = {
    success: true,
    data
  };
  
  return {
    status: 200,
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
app.http('users-get-profile', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'users/me',
  handler: getProfile
});
