/**
 * User Profile API - PATCH /api/users/me
 * 
 * Purpose: Update current authenticated user's profile
 * 
 * Allows partial updates to user profile fields:
 * - displayName: User's preferred display name
 * - timezone: IANA Time Zone Database string (e.g., "America/Los_Angeles")
 * - currency: ISO 4217 currency code (e.g., "USD", "EUR", "GBP")
 * - preferences: Email/push notifications, weekly digest settings
 * 
 * Security:
 * - Requires valid JWT token
 * - Only allows updating current user's profile (no userId param)
 * - Rejects updates to read-only fields (email, userId, id)
 * - Validates timezone against IANA database
 * - Validates currency against ISO 4217 codes
 * 
 * Read-Only Fields (cannot be updated):
 * - id: User identifier (from JWT)
 * - userId: Same as id
 * - email: Email address (from JWT)
 * - type: Document type discriminator
 * - createdAt: Profile creation timestamp
 * - lastLoginAt: Updated automatically on authentication
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import Joi from 'joi';
import { validateJWT } from '../../middleware/auth';
import { getCosmosDbService } from '../../services/cosmosDbService';
import { ApiResponse, UserProfile, ErrorCode } from '../../types/shared';

/**
 * Valid ISO 4217 currency codes (commonly used subset)
 * Full list: https://en.wikipedia.org/wiki/ISO_4217
 */
const VALID_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CAD', 'AUD', 'CHF', 'HKD',
  'SGD', 'SEK', 'KRW', 'NOK', 'NZD', 'MXN', 'ZAR', 'BRL', 'RUB', 'TRY'
] as const;

/**
 * Valid IANA Time Zone Database strings (commonly used subset)
 * Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
 */
const VALID_TIMEZONES = [
  // US & Canada
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
  'America/Anchorage', 'America/Honolulu', 'America/Phoenix', 'America/Toronto',
  'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax',
  
  // Europe
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Vienna', 'Europe/Zurich',
  'Europe/Stockholm', 'Europe/Copenhagen', 'Europe/Oslo', 'Europe/Helsinki',
  'Europe/Dublin', 'Europe/Lisbon', 'Europe/Athens', 'Europe/Prague',
  
  // Asia
  'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore',
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Bangkok', 'Asia/Manila', 'Asia/Jakarta',
  'Asia/Taipei', 'Asia/Kuala_Lumpur', 'Asia/Ho_Chi_Minh', 'Asia/Istanbul',
  
  // Oceania
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth',
  'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Honolulu',
  
  // South America
  'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Santiago', 'America/Lima',
  
  // Africa
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Nairobi', 'Africa/Lagos',
  
  // UTC
  'UTC'
] as const;

/**
 * Update profile request body schema
 */
interface UpdateProfileRequest {
  displayName?: string;
  timezone?: string;
  currency?: string;
  preferences?: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    weeklyDigest?: boolean;
  };
}

/**
 * Joi validation schema for update profile request
 */
const updateProfileSchema = Joi.object({
  displayName: Joi.string().min(1).max(100).trim().optional(),
  timezone: Joi.string().valid(...VALID_TIMEZONES).optional(),
  currency: Joi.string().valid(...VALID_CURRENCIES).optional(),
  preferences: Joi.object({
    emailNotifications: Joi.boolean().optional(),
    pushNotifications: Joi.boolean().optional(),
    weeklyDigest: Joi.boolean().optional(),
  }).optional(),
  
  // Explicitly reject read-only fields
  id: Joi.any().forbidden().messages({
    'any.unknown': 'Field "id" is read-only and cannot be updated'
  }),
  userId: Joi.any().forbidden().messages({
    'any.unknown': 'Field "userId" is read-only and cannot be updated'
  }),
  email: Joi.any().forbidden().messages({
    'any.unknown': 'Field "email" is read-only and cannot be updated'
  }),
  type: Joi.any().forbidden().messages({
    'any.unknown': 'Field "type" is read-only and cannot be updated'
  }),
  createdAt: Joi.any().forbidden().messages({
    'any.unknown': 'Field "createdAt" is read-only and cannot be updated'
  }),
  lastLoginAt: Joi.any().forbidden().messages({
    'any.unknown': 'Field "lastLoginAt" is read-only and cannot be updated'
  }),
}).min(1).messages({
  'object.min': 'Request body must contain at least one field to update'
});

/**
 * Update user profile
 * 
 * @param request - HTTP request with JSON body containing updates
 * @param context - Function invocation context
 * @returns Updated user profile or error response
 */
async function updateProfile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Parse request body
    const body = await request.json() as UpdateProfileRequest;
    
    // Validate request body
    const { error, value } = updateProfileSchema.validate(body, { 
      abortEarly: false,
      stripUnknown: false  // Reject unknown fields
    });
    
    if (error) {
      const validationErrors = error.details.map(detail => detail.message).join('; ');
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Validation failed: ${validationErrors}`,
        400
      );
    }
    
    const updateData = value as UpdateProfileRequest;
    
    // Get Cosmos DB service
    const cosmosService = await getCosmosDbService();
    const container = cosmosService.getUsersContainer();
    
    // Fetch existing user profile
    const userId = authContext.userId;
    const { resource: existingProfile } = await container.item(userId, userId).read<UserProfile>();
    
    if (!existingProfile) {
      context.error(`User profile not found for userId: ${userId}`);
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        'User profile not found. Please try logging in again.',
        404
      );
    }
    
    // Merge updates (partial update)
    const updatedProfile: UserProfile = {
      ...existingProfile,
      ...(updateData.displayName !== undefined && { displayName: updateData.displayName }),
      ...(updateData.timezone !== undefined && { timezone: updateData.timezone }),
      ...(updateData.currency !== undefined && { currency: updateData.currency }),
      ...(updateData.preferences !== undefined && {
        preferences: {
          ...existingProfile.preferences,
          ...updateData.preferences
        }
      }),
      updatedAt: new Date().toISOString(),
    };
    
    // Save updated profile to database
    const { resource: savedProfile } = await container.item(userId, userId).replace(updatedProfile);
    
    if (!savedProfile) {
      throw new Error('Failed to save updated profile');
    }
    
    context.info(`User profile updated: ${userId}`);
    
    // Return updated profile (exclude _etag)
    const profileResponse: Omit<UserProfile, '_etag'> = {
      id: savedProfile.id,
      type: savedProfile.type,
      userId: savedProfile.userId,
      email: savedProfile.email,
      displayName: savedProfile.displayName,
      profilePictureUrl: savedProfile.profilePictureUrl,
      timezone: savedProfile.timezone,
      currency: savedProfile.currency,
      preferences: savedProfile.preferences,
      createdAt: savedProfile.createdAt,
      lastLoginAt: savedProfile.lastLoginAt,
      updatedAt: savedProfile.updatedAt,
    };
    
    return createSuccessResponse(profileResponse);
    
  } catch (error: any) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid JSON in request body',
        400
      );
    }
    
    context.error('Error updating user profile:', error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR, 
      'Failed to update user profile',
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
app.http('users-update-profile', {
  methods: ['PATCH'],
  authLevel: 'function',
  route: 'users/me',
  handler: updateProfile
});
