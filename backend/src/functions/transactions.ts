/**
 * Transactions API Function
 * 
 * RESTful API for Transaction operations
 * 
 * Endpoints:
 * - GET  /api/transactions?householdId={id}&itemId={id}  - List transactions
 * - POST /api/transactions                               - Create transaction (record purchase)
 * - POST /api/transactions/restock                       - One-Tap Restock
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getTransactionRepository } from '../repositories/transactionRepository';
import { getItemRepository } from '../repositories/itemRepository';
import { validateJWT, validateHouseholdAccess } from '../middleware/auth';
import { 
  ApiResponse, 
  CreateTransactionDto,
  OneTapRestockDto,
  ErrorCode,
  IngestionSource
} from '../types/shared';

/**
 * List transactions
 */
async function listTransactions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Validate JWT token
  const authContext = await validateJWT(request, context);
  if (!authContext) {
    return createErrorResponse(ErrorCode.AUTH_INVALID, 'Invalid or missing authentication token', 401);
  }
  
  // Use user's household from auth context (do NOT trust query params)
  const householdId = authContext.householdIds[0];
  
  // Validate household access
  if (!await validateHouseholdAccess(authContext, householdId, context)) {
    return createErrorResponse(ErrorCode.FORBIDDEN, 'Access denied to household', 403);
  }
  
  const itemId = request.query.get('itemId');
  const limit = request.query.get('limit');
  
  try {
    const repository = await getTransactionRepository();
    
    let transactions;
    if (itemId) {
      transactions = await repository.getByItem(itemId, householdId);
    } else if (limit) {
      transactions = await repository.getByHousehold(householdId, parseInt(limit));
    } else {
      transactions = await repository.getByHousehold(householdId);
    }
    
    return createSuccessResponse(transactions);
  } catch (error: any) {
    context.error('Error listing transactions:', error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }
}

/**
 * Create transaction (record purchase)
 */
async function createTransaction(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Validate JWT token
  const authContext = await validateJWT(request, context);
  if (!authContext) {
    return createErrorResponse(ErrorCode.AUTH_INVALID, 'Invalid or missing authentication token', 401);
  }
  
  // Use user's household and ID from auth context (do NOT trust request body)
  const householdId = authContext.householdIds[0];
  const userId = authContext.userId;
  
  // Validate household access
  if (!await validateHouseholdAccess(authContext, householdId, context)) {
    return createErrorResponse(ErrorCode.FORBIDDEN, 'Access denied to household', 403);
  }
  
  try {
    const body = await request.json() as any;
    
    const dto: CreateTransactionDto = {
      itemId: body.itemId,
      purchaseDate: body.purchaseDate || new Date().toISOString(),
      quantity: body.quantity,
      totalPrice: body.totalPrice,
      vendor: body.vendor,
      source: body.source || IngestionSource.MANUAL,
      sourceMetadata: body.sourceMetadata
    };
    
    // Validate required fields
    if (!dto.itemId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'itemId is required', 400);
    }
    
    if (!dto.quantity || dto.quantity <= 0) {
      return createErrorResponse(ErrorCode.INVALID_QUANTITY, 'quantity must be greater than 0', 400);
    }
    
    if (dto.totalPrice < 0) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'totalPrice cannot be negative', 400);
    }
    
    // Verify item exists
    const itemRepo = await getItemRepository();
    const item = await itemRepo.getById(dto.itemId, householdId);
    
    if (!item) {
      return createErrorResponse(ErrorCode.NOT_FOUND, `Item not found: ${dto.itemId}`, 404);
    }
    
    // Create transaction
    const repository = await getTransactionRepository();
    const transaction = await repository.create(householdId, userId, dto);
    
    // Update item's last purchase info
    await itemRepo.update(dto.itemId, householdId, {
      lastPurchaseDate: dto.purchaseDate,
      lastPurchasePrice: dto.totalPrice
    });
    
    context.log(`✅ Transaction created: ${transaction.id} for item ${dto.itemId}`);
    
    return createSuccessResponse(transaction, 201);
  } catch (error: any) {
    context.error('Error creating transaction:', error);
    
    if (error.code === ErrorCode.INVALID_QUANTITY || error.code === ErrorCode.INVALID_DATE) {
      return createErrorResponse(error.code, error.message, 400);
    }
    
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }
}

/**
 * One-Tap Restock
 * 
 * Quickly record a repurchase using previous purchase data as defaults.
 */
async function restock(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Validate JWT token
  const authContext = await validateJWT(request, context);
  if (!authContext) {
    return createErrorResponse(ErrorCode.AUTH_INVALID, 'Invalid or missing authentication token', 401);
  }
  
  // Use user's household and ID from auth context (do NOT trust request body)
  const householdId = authContext.householdIds[0];
  const userId = authContext.userId;
  
  // Validate household access
  if (!await validateHouseholdAccess(authContext, householdId, context)) {
    return createErrorResponse(ErrorCode.FORBIDDEN, 'Access denied to household', 403);
  }
  
  try {
    const body = await request.json() as any;
    
    const dto: OneTapRestockDto = {
      itemId: body.itemId,
      quantity: body.quantity,
      vendor: body.vendor
    };
    
    if (!dto.itemId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'itemId is required', 400);
    }
    
    // Get item details
    const itemRepo = await getItemRepository();
    const item = await itemRepo.getById(dto.itemId, householdId);
    
    if (!item) {
      return createErrorResponse(ErrorCode.NOT_FOUND, `Item not found: ${dto.itemId}`, 404);
    }
    
    // Get last transaction for defaults
    const transactionRepo = await getTransactionRepository();
    const lastTransaction = await transactionRepo.getLastPurchase(dto.itemId, householdId);
    
    // Use provided values or defaults from last purchase
    const quantity = dto.quantity || lastTransaction?.quantity || 1;
    const vendor = dto.vendor || item.preferredVendor || lastTransaction?.vendor;
    const estimatedPrice = lastTransaction?.totalPrice || 0;
    
    // Create transaction
    const transactionDto: CreateTransactionDto = {
      itemId: dto.itemId,
      purchaseDate: new Date().toISOString(),
      quantity,
      totalPrice: estimatedPrice,
      vendor: vendor!,
      source: IngestionSource.MANUAL,
      sourceMetadata: {
        restockAction: true
      }
    };
    
    const transaction = await transactionRepo.create(householdId, userId, transactionDto);
    
    // Update item
    await itemRepo.update(dto.itemId, householdId, {
      lastPurchaseDate: transaction.purchaseDate,
      lastPurchasePrice: transaction.totalPrice,
      quantity: item.quantity + quantity
    });
    
    context.log(`✅ One-Tap Restock: ${item.canonicalName} (${quantity} ${item.unitOfMeasure})`);
    
    return createSuccessResponse({
      transaction,
      message: `${item.canonicalName} restocked successfully`
    }, 201);
  } catch (error: any) {
    context.error('Error during restock:', error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }
}

// Helper functions
function createSuccessResponse<T>(data: T, status: number = 200): HttpResponseInit {
  const response: ApiResponse<T> = {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID()
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

function createErrorResponse(code: ErrorCode, message: string, status: number): HttpResponseInit {
  const response: ApiResponse<never> = {
    success: false,
    error: { code, message },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID()
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

// Register routes
app.http('transactions-list', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'transactions',
  handler: listTransactions
});

app.http('transactions-create', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'transactions',
  handler: createTransaction
});

app.http('transactions-restock', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'transactions/restock',
  handler: restock
});
