import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getCosmosDbService } from '../../services/cosmosDbService';
import { validateJWT } from '../../middleware/auth';
import { logAuditEvent, AuditEventType } from '../../services/auditLogger';
import { ApiResponse, ErrorCode } from '../../types/shared';

/**
 * DELETE /api/users/me
 * 
 * GDPR Article 17 - Right to Erasure (Right to be Forgotten)
 * Deletes user account and all associated data with cascade logic.
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Requires explicit confirmation: { confirmation: "DELETE" } (case-sensitive)
 * 2. Household cleanup:
 *    - Remove user from all households
 *    - If user is only admin: promote next oldest member OR delete household if sole member
 * 3. Cascade deletion:
 *    - Soft-delete items (90-day TTL for retention)
 *    - Hard-delete transactions (immediate)
 *    - Delete all sessions
 *    - Delete user profile
 * 4. Audit logging: Create ACCOUNT_DELETED event (90-day TTL)
 * 5. Return summary of deleted data
 * 
 * @route DELETE /api/users/me
 * @middleware validateJWT
 */
async function deleteAccount(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Step 1: Validate JWT token
  const authContext = await validateJWT(request, context);
  if (!authContext) {
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: ErrorCode.AUTH_INVALID,
        message: 'Unauthorized - valid authentication required'
      }
    };
    return {
      status: 401,
      jsonBody: response,
    };
  }

  try {
    // Step 2: Parse and validate confirmation
    let body: { confirmation?: string };
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch (parseError) {
      context.error('Invalid JSON in request body:', parseError);
      const response: ApiResponse<never> = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid JSON in request body'
        }
      };
      return {
        status: 400,
        jsonBody: response,
      };
    }

    // Require exact confirmation string (case-sensitive)
    if (body.confirmation !== 'DELETE') {
      const response: ApiResponse<never> = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Account deletion requires confirmation. Send { "confirmation": "DELETE" } in request body.'
        }
      };
      return {
        status: 400,
        jsonBody: response,
      };
    }

    const userId = authContext.userId;
    const userEmail = authContext.email || 'unknown';

    context.log(`Starting account deletion for user ${userId} (${userEmail})`);

    // Get Cosmos DB service
    const cosmosService = await getCosmosDbService();

    // Initialize counters for summary
    const summary = {
      householdsLeft: 0,
      householdsDeleted: 0,
      itemsDeleted: 0,
      transactionsDeleted: 0,
      sessionsDeleted: 0,
    };

    // Step 3: Fetch user profile to verify existence
    const usersContainer = cosmosService.getUsersContainer();
    let userProfile;
    try {
      const { resource } = await usersContainer.item(userId, userId).read();
      userProfile = resource;
      if (!userProfile) {
        const response: ApiResponse<never> = {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: 'User profile not found'
          }
        };
        return {
          status: 404,
          jsonBody: response,
        };
      }
    } catch (error: any) {
      if (error.code === 404) {
        const response: ApiResponse<never> = {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: 'User profile not found'
          }
        };
        return {
          status: 404,
          jsonBody: response,
        };
      }
      throw error;
    }

    // Step 4: Handle household memberships and cleanup
    const householdsContainer = cosmosService.getHouseholdsContainer();
    const householdIds = userProfile.householdIds || [];

    context.log(`User is member of ${householdIds.length} household(s)`);

    for (const householdId of householdIds) {
      try {
        // Fetch household
        const { resource: household } = await householdsContainer
          .item(householdId, householdId)
          .read();

        if (!household) {
          context.warn(`Household ${householdId} not found, skipping`);
          continue;
        }

        const members = household.members || [];
        const userMember = members.find((m: any) => m.userId === userId);

        if (!userMember) {
          context.warn(`User ${userId} not found in household ${householdId} members, skipping`);
          continue;
        }

        // Case 1: User is sole member → Delete entire household
        if (members.length === 1) {
          context.log(`User is sole member of household ${householdId}, deleting household`);

          // Delete household
          await householdsContainer.item(householdId, householdId).delete();
          summary.householdsDeleted++;

          // Delete all household items (with 90-day TTL for soft delete)
          const itemsContainer = cosmosService.getItemsContainer();
          const { resources: householdItems } = await itemsContainer.items
            .query({
              query: 'SELECT * FROM c WHERE c.householdId = @householdId AND c.type = @type',
              parameters: [
                { name: '@householdId', value: householdId },
                { name: '@type', value: 'item' },
              ],
            })
            .fetchAll();

          for (const item of householdItems) {
            try {
              // Soft delete: set TTL for 90-day retention (7776000 seconds)
              await itemsContainer
                .item(item.id, householdId)
                .replace({ ...item, ttl: 7776000, deletedAt: new Date().toISOString() });
              summary.itemsDeleted++;
            } catch (error) {
              context.error(`Failed to delete item ${item.id}:`, error);
            }
          }

          // Hard delete all household transactions
          const transactionsContainer = cosmosService.getTransactionsContainer();
          const { resources: householdTransactions } = await transactionsContainer.items
            .query({
              query: 'SELECT * FROM c WHERE c.householdId = @householdId AND c.type = @type',
              parameters: [
                { name: '@householdId', value: householdId },
                { name: '@type', value: 'transaction' },
              ],
            })
            .fetchAll();

          for (const transaction of householdTransactions) {
            try {
              await transactionsContainer.item(transaction.id, householdId).delete();
              summary.transactionsDeleted++;
            } catch (error) {
              context.error(`Failed to delete transaction ${transaction.id}:`, error);
            }
          }
        }
        // Case 2: User is admin but not sole member → Promote next admin
        else if (userMember.role === 'admin') {
          const otherMembers = members.filter((m: any) => m.userId !== userId);
          const hasOtherAdmin = otherMembers.some((m: any) => m.role === 'admin');

          if (!hasOtherAdmin) {
            // Find next oldest member (earliest joinedAt)
            const nextAdmin = otherMembers.reduce((oldest: any, current: any) => {
              const oldestDate = new Date(oldest.joinedAt).getTime();
              const currentDate = new Date(current.joinedAt).getTime();
              return currentDate < oldestDate ? current : oldest;
            }, otherMembers[0]);

            context.log(
              `Promoting user ${nextAdmin.userId} to admin of household ${householdId}`
            );

            // Update next admin's role
            nextAdmin.role = 'admin';
          }

          // Remove user from members array
          household.members = members.filter((m: any) => m.userId !== userId);
          household.updatedAt = new Date().toISOString();

          // Save updated household
          await householdsContainer.item(householdId, householdId).replace(household);
          summary.householdsLeft++;

          context.log(`Removed user from household ${householdId} and promoted new admin if needed`);
        }
        // Case 3: User is member (not admin) → Just remove from household
        else {
          household.members = members.filter((m: any) => m.userId !== userId);
          household.updatedAt = new Date().toISOString();

          await householdsContainer.item(householdId, householdId).replace(household);
          summary.householdsLeft++;

          context.log(`Removed user from household ${householdId}`);
        }
      } catch (error) {
        context.error(`Failed to process household ${householdId}:`, error);
        // Continue with other households instead of failing entire operation
      }
    }

    // Step 5: Delete all user sessions
    const sessionsContainer = cosmosService.getSessionsContainer();
    try {
      const { resources: userSessions } = await sessionsContainer.items
        .query({
          query: 'SELECT * FROM c WHERE c.userId = @userId AND c.type = @type',
          parameters: [
            { name: '@userId', value: userId },
            { name: '@type', value: 'session' },
          ],
        })
        .fetchAll();

      for (const session of userSessions) {
        try {
          await sessionsContainer.item(session.id, userId).delete();
          summary.sessionsDeleted++;
          context.log(`Deleted session ${session.id}`);
        } catch (error) {
          context.error(`Failed to delete session ${session.id}:`, error);
        }
      }

      context.log(`Deleted ${summary.sessionsDeleted} session(s)`);
    } catch (error) {
      context.error('Failed to delete sessions:', error);
      // Continue with deletion even if session cleanup fails
    }

    // Step 6: Create final audit log entry (ACCOUNT_DELETED)
    try {
      await logAuditEvent({
        eventType: AuditEventType.ACCOUNT_DELETED,
        userId,
        householdId: householdIds[0] || 'none',
        metadata: {
          email: userEmail,
          summary,
          deletionConfirmedAt: new Date().toISOString(),
        },
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      }, context);
      
      context.log('Created ACCOUNT_DELETED audit log entry');
    } catch (error) {
      context.error('Failed to create audit log:', error);
      // Continue with deletion even if audit log fails
    }

    // Step 7: Delete user profile (final step)
    try {
      await usersContainer.item(userId, userId).delete();
      context.log(`Deleted user profile ${userId}`);
    } catch (error) {
      context.error('Failed to delete user profile:', error);
      throw error; // This is critical, so we throw
    }

    // Step 8: Return success response with summary
    const response: ApiResponse<{ message: string; summary: typeof summary }> = {
      success: true,
      data: {
        message: 'Account deleted successfully',
        summary,
      }
    };
    
    return {
      status: 200,
      jsonBody: response,
    };
  } catch (error: any) {
    context.error('Account deletion error:', error);

    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to delete account',
        details: error.message
      }
    };
    
    return {
      status: 500,
      jsonBody: response,
    };
  }
}

// Register HTTP trigger
app.http('users-delete-account', {
  methods: ['DELETE'],
  authLevel: 'function',
  route: 'users/me',
  handler: deleteAccount
});
