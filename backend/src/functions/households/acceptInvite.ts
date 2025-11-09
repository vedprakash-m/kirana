/**
 * Household Invitation Acceptance API - POST /api/invites/:code/accept
 * 
 * Purpose: Accept household invitation and join household as member
 * 
 * This endpoint allows users to accept invitations and join households.
 * The invitee must be authenticated, and the invitation must be valid
 * (pending status, not expired).
 * 
 * Security:
 * - Requires valid JWT token
 * - Validates invitation exists and is still valid
 * - Prevents duplicate memberships
 * - Uses optimistic concurrency (etag) to handle race conditions
 * 
 * Acceptance Flow:
 * 1. User clicks invite link: https://kirana.vedprakash.net/invite/{code}
 * 2. Frontend authenticates user (if not already logged in)
 * 3. Frontend calls POST /api/invites/{code}/accept
 * 4. Backend validates invitation and adds user to household
 * 5. User is redirected to household dashboard
 * 
 * Race Condition Handling:
 * - Multiple concurrent acceptances of same invitation
 * - User already added to household by another process
 * - Invitation status changed by another process
 * - Uses Cosmos DB etag for optimistic concurrency control
 * 
 * Post-Acceptance:
 * - Invitation status → 'accepted'
 * - User added to household.members with role='member'
 * - Invitation TTL ensures cleanup after 7 days
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateJWT } from '../../middleware/auth';
import { getCosmosDbService } from '../../services/cosmosDbService';
import { 
  ApiResponse, 
  Invitation, 
  Household, 
  HouseholdMember,
  HouseholdRole, 
  ErrorCode 
} from '../../types/shared';

/**
 * Response interface
 */
interface AcceptInviteResponse {
  household: {
    id: string;
    name: string;
    memberCount: number;
    role: HouseholdRole;
  };
  message: string;
}

/**
 * Accept household invitation
 * 
 * @param request - HTTP request with inviteCode in path
 * @param context - Function invocation context
 * @returns Household details after successful acceptance
 */
async function acceptInvite(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Validate JWT token
  const authContext = await validateJWT(request, context);
  if (!authContext) {
    return createErrorResponse(
      ErrorCode.AUTH_INVALID,
      'Invalid or missing authentication token',
      401
    );
  }

  // Get invite code from path parameters
  const inviteCode = request.params.code;
  if (!inviteCode) {
    return createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invite code is required in path',
      400
    );
  }

  try {
    // Get Cosmos DB service
    const cosmosService = await getCosmosDbService();
    const invitationsContainer = cosmosService.getInvitationsContainer();
    const householdsContainer = cosmosService.getHouseholdsContainer();

    // Fetch invitation by code
    // Note: We need to query because we don't know the householdId (partition key)
    const { resources: invitations } = await invitationsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @inviteCode',
        parameters: [{ name: '@inviteCode', value: inviteCode }]
      })
      .fetchAll();

    if (invitations.length === 0) {
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        'Invitation not found. The invite link may be invalid or expired.',
        404
      );
    }

    const invitation = invitations[0] as Invitation;

    // Validate invitation status
    if (invitation.status !== 'pending') {
      if (invitation.status === 'accepted') {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'This invitation has already been accepted.',
          409  // Conflict
        );
      } else if (invitation.status === 'expired') {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'This invitation has expired. Please request a new invitation.',
          410  // Gone
        );
      }
    }

    // Validate invitation not expired
    const now = new Date();
    const expiresAt = new Date(invitation.expiresAt);
    
    if (now > expiresAt) {
      // Mark as expired (status will be updated later)
      context.warn(`Invitation ${inviteCode} has expired. Expires at: ${invitation.expiresAt}`);
      
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `This invitation expired on ${expiresAt.toISOString()}. Please request a new invitation.`,
        410  // Gone
      );
    }

    // Fetch household to verify it exists
    const householdId = invitation.householdId;
    const { resource: household } = await householdsContainer
      .item(householdId, householdId)
      .read<Household>();

    if (!household) {
      context.error(`Household not found for invitation ${inviteCode}: ${householdId}`);
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        'The household for this invitation no longer exists.',
        404
      );
    }

    // Check if user is already a member of the household
    const existingMember = household.members.find(m => m.userId === authContext.userId);
    
    if (existingMember) {
      context.info(`User ${authContext.userId} is already a member of household ${householdId}`);
      
      // Mark invitation as accepted (idempotent)
      try {
        const updatedInvitation: Invitation = {
          ...invitation,
          status: 'accepted',
          acceptedAt: now.toISOString(),
          acceptedBy: authContext.userId,
        };
        
        await invitationsContainer
          .item(invitation.id, invitation.householdId)
          .replace(updatedInvitation);
      } catch (error) {
        // Non-critical error - log and continue
        context.warn('Failed to update invitation status (user already member):', error);
      }
      
      // Return success response (idempotent operation)
      const response: AcceptInviteResponse = {
        household: {
          id: household.id,
          name: household.name,
          memberCount: household.members.length,
          role: existingMember.role,
        },
        message: 'You are already a member of this household.',
      };
      
      return createSuccessResponse(response);
    }

    // Add user to household members array
    const newMember: HouseholdMember = {
      userId: authContext.userId,
      email: authContext.email,
      displayName: authContext.userProfile.displayName,
      role: HouseholdRole.MEMBER,  // Always add as member (not admin)
      joinedAt: now.toISOString(),
      invitedBy: invitation.invitedBy,
    };

    const updatedHousehold: Household = {
      ...household,
      members: [...household.members, newMember],
      updatedAt: now.toISOString(),
    };

    // Update household with optimistic concurrency control (etag)
    let householdUpdateSuccess = false;
    let retryCount = 0;
    const maxRetries = 3;

    while (!householdUpdateSuccess && retryCount < maxRetries) {
      try {
        await householdsContainer
          .item(householdId, householdId)
          .replace(updatedHousehold, {
            accessCondition: { type: 'IfMatch', condition: household._etag || '' }
          });
        
        householdUpdateSuccess = true;
        context.info(`User ${authContext.userId} added to household ${householdId} (attempt ${retryCount + 1})`);
        
      } catch (error: any) {
        if (error.code === 412) {  // Precondition Failed (etag mismatch)
          retryCount++;
          context.warn(`Household update conflict (attempt ${retryCount}/${maxRetries}). Retrying...`);
          
          if (retryCount < maxRetries) {
            // Re-fetch household and check if user was added by another process
            const { resource: latestHousehold } = await householdsContainer
              .item(householdId, householdId)
              .read<Household>();
            
            if (!latestHousehold) {
              throw new Error('Household no longer exists');
            }
            
            // Check if user was added by concurrent request
            const memberExists = latestHousehold.members.find(m => m.userId === authContext.userId);
            if (memberExists) {
              // User was added by concurrent request - treat as success
              householdUpdateSuccess = true;
              context.info(`User ${authContext.userId} already added to household by concurrent request`);
              break;
            }
            
            // Update with latest data and retry
            updatedHousehold.members = [...latestHousehold.members, newMember];
            updatedHousehold._etag = latestHousehold._etag;
          } else {
            throw new Error('Failed to add user to household after maximum retries due to concurrent updates');
          }
        } else {
          throw error;  // Re-throw non-412 errors
        }
      }
    }

    if (!householdUpdateSuccess) {
      return createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Failed to join household due to concurrent updates. Please try again.',
        409  // Conflict
      );
    }

    // Update invitation status to 'accepted'
    try {
      const updatedInvitation: Invitation = {
        ...invitation,
        status: 'accepted',
        acceptedAt: now.toISOString(),
        acceptedBy: authContext.userId,
      };
      
      await invitationsContainer
        .item(invitation.id, invitation.householdId)
        .replace(updatedInvitation);
      
      context.info(`Invitation ${inviteCode} marked as accepted by ${authContext.userId}`);
      
    } catch (error) {
      // Non-critical error - user was added successfully, log and continue
      context.error('Failed to update invitation status (non-critical):', error);
    }

    // Return success response
    const response: AcceptInviteResponse = {
      household: {
        id: household.id,
        name: household.name,
        memberCount: updatedHousehold.members.length,
        role: HouseholdRole.MEMBER,
      },
      message: `Successfully joined ${household.name}!`,
    };

    return createSuccessResponse(response);

  } catch (error: any) {
    context.error('Error accepting invitation:', error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to accept invitation. Please try again.',
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
app.http('invites-accept', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'invites/{code}/accept',
  handler: acceptInvite
});
