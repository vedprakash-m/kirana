/**
 * Household Invitation API - POST /api/households/:id/invite
 * 
 * Purpose: Admin users can invite family members to join their household
 * 
 * This endpoint creates invitation links that allow new users to join an existing
 * household. Only users with 'admin' role in the household can create invitations.
 * 
 * Security:
 * - Requires valid JWT token
 * - Validates user is admin of the household
 * - Validates household exists and user has access
 * - Prevents duplicate active invitations for same email
 * 
 * Invitation Flow:
 * 1. Admin creates invitation with invitee's email
 * 2. System generates unique 32-character invite code
 * 3. System creates invitation record with 7-day expiry
 * 4. Returns invitation URL: https://kirana.vedprakash.net/invite/{code}
 * 5. Invitee clicks link and accepts invitation (Task 2.2.3)
 * 6. Invitee is added to household as 'member' role
 * 
 * TTL Behavior:
 * - Invitations expire after 7 days (604800 seconds)
 * - Cosmos DB automatically deletes expired invitations via TTL
 * - Status changes to 'expired' before deletion
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomBytes } from 'crypto';
import Joi from 'joi';
import { validateJWT, validateHouseholdAccess } from '../../middleware/auth';
import { getCosmosDbService } from '../../services/cosmosDbService';
import { ApiResponse, Invitation, Household, HouseholdRole, ErrorCode } from '../../types/shared';

/**
 * Request body interface
 */
interface CreateInviteRequest {
  invitedEmail: string;
}

/**
 * Response interface
 */
interface CreateInviteResponse {
  inviteCode: string;
  inviteUrl: string;
  invitedEmail: string;
  expiresAt: string;
  householdName: string;
}

/**
 * Joi validation schema for request body
 */
const createInviteSchema = Joi.object({
  invitedEmail: Joi.string()
    .email({ tlds: { allow: false } })  // Allow all TLDs
    .required()
    .trim()
    .lowercase()
    .messages({
      'string.email': 'Invalid email address format',
      'any.required': 'invitedEmail is required'
    })
});

/**
 * Create household invitation
 * 
 * @param request - HTTP request with householdId in path and invitedEmail in body
 * @param context - Function invocation context
 * @returns Invitation details with invite URL
 */
async function createInvite(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Validate JWT token
  const authContext = await validateJWT(request, context);
  if (!authContext) {
    return createErrorResponse(
      ErrorCode.AUTH_INVALID,
      'Invalid or missing authentication token',
      401
    );
  }

  // Get householdId from path parameters
  const householdId = request.params.id;
  if (!householdId) {
    return createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'householdId is required in path',
      400
    );
  }

  // Validate household access
  if (!await validateHouseholdAccess(authContext, householdId, context)) {
    return createErrorResponse(
      ErrorCode.FORBIDDEN,
      'Access denied to household',
      403
    );
  }

  try {
    // Parse and validate request body
    const body = await request.json() as CreateInviteRequest;
    
    const { error, value } = createInviteSchema.validate(body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => detail.message).join('; ');
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Validation failed: ${validationErrors}`,
        400
      );
    }

    const { invitedEmail } = value;

    // Get Cosmos DB service
    const cosmosService = await getCosmosDbService();
    const householdsContainer = cosmosService.getHouseholdsContainer();
    const invitationsContainer = cosmosService.getInvitationsContainer();

    // Fetch household to verify it exists and get details
    const { resource: household } = await householdsContainer.item(householdId, householdId).read<Household>();

    if (!household) {
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        `Household not found: ${householdId}`,
        404
      );
    }

    // Verify user is admin of this household
    const currentUserMember = household.members.find(m => m.userId === authContext.userId);
    
    if (!currentUserMember || currentUserMember.role !== HouseholdRole.ADMIN) {
      context.warn(
        `Non-admin user ${authContext.userId} attempted to create invitation for household ${householdId}. ` +
        `User role: ${currentUserMember?.role || 'not a member'}`
      );
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        'Only household admins can create invitations',
        403
      );
    }

    // Check if user is already a member of the household
    const existingMember = household.members.find(m => m.email.toLowerCase() === invitedEmail.toLowerCase());
    if (existingMember) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `User ${invitedEmail} is already a member of this household`,
        400
      );
    }

    // Check for existing pending invitations for this email in this household
    const { resources: existingInvites } = await invitationsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.householdId = @householdId AND c.invitedEmail = @email AND c.status = @status',
        parameters: [
          { name: '@householdId', value: householdId },
          { name: '@email', value: invitedEmail },
          { name: '@status', value: 'pending' }
        ]
      })
      .fetchAll();

    if (existingInvites.length > 0) {
      const existingInvite = existingInvites[0];
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `An active invitation already exists for ${invitedEmail}. Expires at: ${existingInvite.expiresAt}`,
        409  // Conflict
      );
    }

    // Generate unique 32-character invite code
    const inviteCode = randomBytes(16).toString('hex');  // 16 bytes = 32 hex characters

    // Calculate expiry (7 days from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);  // 7 days

    // Create invitation record
    const invitation: Invitation = {
      id: inviteCode,
      type: 'invitation',
      householdId,
      invitedBy: authContext.userId,
      invitedEmail,
      inviteCode,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ttl: 604800,  // 7 days in seconds
    };

    // Save invitation to database
    await invitationsContainer.items.create(invitation);

    context.info(
      `Invitation created: ${inviteCode} for ${invitedEmail} to household ${householdId} by ${authContext.userId}`
    );

    // Construct invite URL
    const inviteUrl = `https://kirana.vedprakash.net/invite/${inviteCode}`;

    // Return invitation details
    const response: CreateInviteResponse = {
      inviteCode,
      inviteUrl,
      invitedEmail,
      expiresAt: expiresAt.toISOString(),
      householdName: household.name,
    };

    return createSuccessResponse(response, 201);

  } catch (error: any) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid JSON in request body',
        400
      );
    }

    context.error('Error creating invitation:', error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to create invitation',
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
app.http('households-create-invite', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'households/{id}/invite',
  handler: createInvite
});
