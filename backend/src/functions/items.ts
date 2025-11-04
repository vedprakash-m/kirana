/**
 * Items API Function
 * 
 * RESTful API for Item CRUD operations
 * 
 * Endpoints:
 * - GET    /api/items?householdId={id}           - List all items
 * - GET    /api/items/{id}?householdId={id}      - Get item by ID
 * - POST   /api/items                            - Create item
 * - PUT    /api/items/{id}                       - Update item
 * - DELETE /api/items/{id}                       - Delete item (soft)
 * - GET    /api/items/running-out?householdId={id} - Get items running out soon
 * - GET    /api/items/low-confidence?householdId={id} - Get low confidence items
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getItemRepository } from '../repositories/itemRepository';
import { 
  ApiResponse, 
  CreateItemDto, 
  UpdateItemDto,
  ErrorCode 
} from '../types/shared';

/**
 * List all items for a household
 */
async function listItems(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const householdId = request.query.get('householdId');
  
  if (!householdId) {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'householdId query parameter is required', 400);
  }
  
  try {
    const repository = await getItemRepository();
    const items = await repository.getByHousehold(householdId);
    
    return createSuccessResponse(items);
  } catch (error: any) {
    context.error('Error listing items:', error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }
}

/**
 * Get item by ID
 */
async function getItem(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const itemId = request.params.id;
  const householdId = request.query.get('householdId');
  
  if (!householdId) {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'householdId query parameter is required', 400);
  }
  
  if (!itemId) {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'itemId is required', 400);
  }
  
  try {
    const repository = await getItemRepository();
    const item = await repository.getById(itemId, householdId);
    
    if (!item) {
      return createErrorResponse(ErrorCode.NOT_FOUND, `Item not found: ${itemId}`, 404);
    }
    
    return createSuccessResponse(item);
  } catch (error: any) {
    context.error('Error getting item:', error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }
}

/**
 * Create new item
 */
async function createItem(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = await request.json() as any;
    
    // Validate required fields
    if (!body.householdId || !body.userId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'householdId and userId are required', 400);
    }
    
    const dto: CreateItemDto = {
      canonicalName: body.canonicalName,
      brand: body.brand,
      category: body.category,
      quantity: body.quantity,
      unitOfMeasure: body.unitOfMeasure,
      packageSize: body.packageSize,
      packageUnit: body.packageUnit,
      preferredVendor: body.preferredVendor,
      teachModeEnabled: body.teachModeEnabled,
      teachModeFrequencyDays: body.teachModeFrequencyDays
    };
    
    // Basic validation
    if (!dto.canonicalName || dto.canonicalName.length === 0) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'canonicalName is required', 400);
    }
    
    if (!dto.category) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'category is required', 400);
    }
    
    if (dto.quantity <= 0) {
      return createErrorResponse(ErrorCode.INVALID_QUANTITY, 'quantity must be greater than 0', 400);
    }
    
    const repository = await getItemRepository();
    const item = await repository.create(body.householdId, body.userId, dto);
    
    return createSuccessResponse(item, 201);
  } catch (error: any) {
    context.error('Error creating item:', error);
    
    if (error.code === ErrorCode.DUPLICATE_ITEM) {
      return createErrorResponse(error.code, error.message, 409);
    }
    
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }
}

/**
 * Update item
 */
async function updateItem(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const itemId = request.params.id;
  
  if (!itemId) {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'itemId is required', 400);
  }
  
  try {
    const body = await request.json() as any;
    
    if (!body.householdId) {
      return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'householdId is required', 400);
    }
    
    const dto: UpdateItemDto = {
      canonicalName: body.canonicalName,
      brand: body.brand,
      category: body.category,
      quantity: body.quantity,
      unitOfMeasure: body.unitOfMeasure,
      packageSize: body.packageSize,
      packageUnit: body.packageUnit,
      preferredVendor: body.preferredVendor,
      teachModeEnabled: body.teachModeEnabled,
      teachModeFrequencyDays: body.teachModeFrequencyDays
    };
    
    const etag = request.headers.get('if-match');
    
    const repository = await getItemRepository();
    const item = await repository.update(itemId, body.householdId, dto, etag || undefined);
    
    return createSuccessResponse(item);
  } catch (error: any) {
    context.error('Error updating item:', error);
    
    if (error.code === ErrorCode.NOT_FOUND) {
      return createErrorResponse(error.code, error.message, 404);
    }
    
    if (error.code === ErrorCode.CONFLICT) {
      return createErrorResponse(error.code, error.message, 412);
    }
    
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }
}

/**
 * Delete item (soft delete)
 */
async function deleteItem(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const itemId = request.params.id;
  const householdId = request.query.get('householdId');
  
  if (!itemId || !householdId) {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'itemId and householdId are required', 400);
  }
  
  try {
    const repository = await getItemRepository();
    await repository.delete(itemId, householdId);
    
    return createSuccessResponse({ message: 'Item deleted successfully' });
  } catch (error: any) {
    context.error('Error deleting item:', error);
    
    if (error.code === ErrorCode.NOT_FOUND) {
      return createErrorResponse(error.code, error.message, 404);
    }
    
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }
}

/**
 * Get items running out soon
 */
async function getRunningOutSoon(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const householdId = request.query.get('householdId');
  const days = request.query.get('days');
  
  if (!householdId) {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'householdId query parameter is required', 400);
  }
  
  const daysThreshold = days ? parseInt(days) : 7;
  
  try {
    const repository = await getItemRepository();
    const items = await repository.getRunningOutSoon(householdId, daysThreshold);
    
    return createSuccessResponse(items);
  } catch (error: any) {
    context.error('Error getting running out items:', error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }
}

/**
 * Get low confidence items
 */
async function getLowConfidence(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const householdId = request.query.get('householdId');
  
  if (!householdId) {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'householdId query parameter is required', 400);
  }
  
  try {
    const repository = await getItemRepository();
    const items = await repository.getLowConfidenceItems(householdId);
    
    return createSuccessResponse(items);
  } catch (error: any) {
    context.error('Error getting low confidence items:', error);
    return createErrorResponse(ErrorCode.INTERNAL_ERROR, error.message, 500);
  }
}

/**
 * Get confidence stats
 */
async function getStats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const householdId = request.query.get('householdId');
  
  if (!householdId) {
    return createErrorResponse(ErrorCode.VALIDATION_ERROR, 'householdId query parameter is required', 400);
  }
  
  try {
    const repository = await getItemRepository();
    const stats = await repository.getConfidenceStats(householdId);
    
    return createSuccessResponse(stats);
  } catch (error: any) {
    context.error('Error getting stats:', error);
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
app.http('items-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'items',
  handler: listItems
});

app.http('items-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'items/{id}',
  handler: getItem
});

app.http('items-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'items',
  handler: createItem
});

app.http('items-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'items/{id}',
  handler: updateItem
});

app.http('items-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'items/{id}',
  handler: deleteItem
});

app.http('items-running-out', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'items/running-out',
  handler: getRunningOutSoon
});

app.http('items-low-confidence', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'items/low-confidence',
  handler: getLowConfidence
});

app.http('items-stats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'items/stats',
  handler: getStats
});
