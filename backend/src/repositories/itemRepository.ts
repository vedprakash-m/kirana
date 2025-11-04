/**
 * Item Repository
 * 
 * Data access layer for Item entities in Cosmos DB.
 * Handles CRUD operations, queries, and business logic validation.
 */

import { Container } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import { 
  Item, 
  CreateItemDto, 
  UpdateItemDto, 
  PredictionConfidence,
  ApiError,
  ErrorCode 
} from '../types/shared';
import { getCosmosDbService } from '../services/cosmosDbService';

export class ItemRepository {
  private container: Container | null = null;
  
  /**
   * Initialize repository
   */
  async initialize(): Promise<void> {
    const cosmosService = await getCosmosDbService();
    this.container = cosmosService.getItemsContainer();
  }
  
  /**
   * Get container (ensures initialization)
   */
  private async getContainer(): Promise<Container> {
    if (!this.container) {
      await this.initialize();
    }
    if (!this.container) {
      throw new Error('Item container not initialized');
    }
    return this.container;
  }
  
  /**
   * Create a new item
   */
  async create(
    householdId: string,
    userId: string,
    dto: CreateItemDto
  ): Promise<Item> {
    const container = await this.getContainer();
    
    const now = new Date().toISOString();
    const item: Item = {
      id: uuidv4(),
      householdId,
      
      // Identity
      canonicalName: dto.canonicalName,
      brand: dto.brand,
      category: dto.category,
      
      // Physical Properties
      quantity: dto.quantity,
      unitOfMeasure: dto.unitOfMeasure,
      packageSize: dto.packageSize,
      packageUnit: dto.packageUnit,
      
      // Purchase Info
      preferredVendor: dto.preferredVendor,
      priceHistory: [],
      
      // Predictions
      predictionConfidence: PredictionConfidence.NONE,
      
      // User Preferences
      userOverrides: [],
      teachModeEnabled: dto.teachModeEnabled || false,
      teachModeFrequencyDays: dto.teachModeFrequencyDays,
      
      // Metadata
      createdAt: now,
      updatedAt: now,
      createdBy: userId
    };
    
    try {
      const { resource } = await container.items.create(item);
      return resource as Item;
    } catch (error: any) {
      if (error.code === 409) {
        throw this.createError(ErrorCode.DUPLICATE_ITEM, `Item already exists: ${dto.canonicalName}`);
      }
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to create item: ${error.message}`);
    }
  }
  
  /**
   * Get item by ID
   */
  async getById(itemId: string, householdId: string): Promise<Item | null> {
    const container = await this.getContainer();
    
    try {
      const { resource } = await container.item(itemId, householdId).read<Item>();
      
      // Filter out soft-deleted items
      if (resource && resource.deletedAt) {
        return null;
      }
      
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to get item: ${error.message}`);
    }
  }
  
  /**
   * Get all items for a household
   */
  async getByHousehold(
    householdId: string,
    includeDeleted: boolean = false
  ): Promise<Item[]> {
    const container = await this.getContainer();
    
    const query = includeDeleted
      ? `SELECT * FROM c WHERE c.householdId = @householdId`
      : `SELECT * FROM c WHERE c.householdId = @householdId AND NOT IS_DEFINED(c.deletedAt)`;
    
    try {
      const { resources } = await container.items
        .query<Item>({
          query,
          parameters: [{ name: '@householdId', value: householdId }]
        })
        .fetchAll();
      
      return resources;
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to get items: ${error.message}`);
    }
  }
  
  /**
   * Get items running out soon (≤7 days)
   */
  async getRunningOutSoon(householdId: string, daysThreshold: number = 7): Promise<Item[]> {
    const container = await this.getContainer();
    
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
    const thresholdISO = thresholdDate.toISOString();
    
    const query = `
      SELECT * FROM c 
      WHERE c.householdId = @householdId 
        AND NOT IS_DEFINED(c.deletedAt)
        AND IS_DEFINED(c.predictedRunOutDate)
        AND c.predictedRunOutDate <= @threshold
      ORDER BY c.predictedRunOutDate ASC
    `;
    
    try {
      const { resources } = await container.items
        .query<Item>({
          query,
          parameters: [
            { name: '@householdId', value: householdId },
            { name: '@threshold', value: thresholdISO }
          ]
        })
        .fetchAll();
      
      return resources;
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to get items running out soon: ${error.message}`);
    }
  }
  
  /**
   * Get items with low confidence predictions
   */
  async getLowConfidenceItems(householdId: string): Promise<Item[]> {
    const container = await this.getContainer();
    
    const query = `
      SELECT * FROM c 
      WHERE c.householdId = @householdId 
        AND NOT IS_DEFINED(c.deletedAt)
        AND c.predictionConfidence = 'Low'
    `;
    
    try {
      const { resources } = await container.items
        .query<Item>({
          query,
          parameters: [{ name: '@householdId', value: householdId }]
        })
        .fetchAll();
      
      return resources;
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to get low confidence items: ${error.message}`);
    }
  }
  
  /**
   * Update an item
   */
  async update(
    itemId: string,
    householdId: string,
    dto: UpdateItemDto,
    etag?: string
  ): Promise<Item> {
    const container = await this.getContainer();
    
    // Get existing item
    const existing = await this.getById(itemId, householdId);
    if (!existing) {
      throw this.createError(ErrorCode.NOT_FOUND, `Item not found: ${itemId}`);
    }
    
    // Merge updates
    const updated: Item = {
      ...existing,
      ...dto,
      updatedAt: new Date().toISOString()
    };
    
    try {
      const { resource } = await container
        .item(itemId, householdId)
        .replace(updated, etag ? { accessCondition: { type: 'IfMatch', condition: etag } } : undefined);
      
      return resource as Item;
    } catch (error: any) {
      if (error.code === 412) {
        throw this.createError(ErrorCode.CONFLICT, 'Item was modified by another user. Please refresh and try again.');
      }
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to update item: ${error.message}`);
    }
  }
  
  /**
   * Update item prediction data
   */
  async updatePrediction(
    itemId: string,
    householdId: string,
    predictionData: {
      predictedRunOutDate: string;
      predictionConfidence: PredictionConfidence;
      avgFrequencyDays: number;
      avgConsumptionRate: number;
    }
  ): Promise<Item> {
    const container = await this.getContainer();
    
    const existing = await this.getById(itemId, householdId);
    if (!existing) {
      throw this.createError(ErrorCode.NOT_FOUND, `Item not found: ${itemId}`);
    }
    
    const updated: Item = {
      ...existing,
      ...predictionData,
      updatedAt: new Date().toISOString()
    };
    
    try {
      const { resource } = await container.item(itemId, householdId).replace(updated);
      return resource as Item;
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to update prediction: ${error.message}`);
    }
  }
  
  /**
   * Soft delete an item
   */
  async delete(itemId: string, householdId: string): Promise<void> {
    const container = await this.getContainer();
    
    const existing = await this.getById(itemId, householdId);
    if (!existing) {
      throw this.createError(ErrorCode.NOT_FOUND, `Item not found: ${itemId}`);
    }
    
    const softDeleted: Item = {
      ...existing,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      await container.item(itemId, householdId).replace(softDeleted);
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to delete item: ${error.message}`);
    }
  }
  
  /**
   * Permanently delete an item (use with caution)
   */
  async hardDelete(itemId: string, householdId: string): Promise<void> {
    const container = await this.getContainer();
    
    try {
      await container.item(itemId, householdId).delete();
    } catch (error: any) {
      if (error.code === 404) {
        // Already deleted, no-op
        return;
      }
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to hard delete item: ${error.message}`);
    }
  }
  
  /**
   * Search items by name
   */
  async search(householdId: string, searchTerm: string): Promise<Item[]> {
    const container = await this.getContainer();
    
    const query = `
      SELECT * FROM c 
      WHERE c.householdId = @householdId 
        AND NOT IS_DEFINED(c.deletedAt)
        AND (
          CONTAINS(LOWER(c.canonicalName), @searchTerm)
          OR CONTAINS(LOWER(c.brand), @searchTerm)
        )
    `;
    
    try {
      const { resources } = await container.items
        .query<Item>({
          query,
          parameters: [
            { name: '@householdId', value: householdId },
            { name: '@searchTerm', value: searchTerm.toLowerCase() }
          ]
        })
        .fetchAll();
      
      return resources;
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to search items: ${error.message}`);
    }
  }
  
  /**
   * Get count of items by confidence level
   */
  async getConfidenceStats(householdId: string): Promise<{
    high: number;
    medium: number;
    low: number;
    none: number;
  }> {
    const items = await this.getByHousehold(householdId);
    
    return {
      high: items.filter(i => i.predictionConfidence === PredictionConfidence.HIGH).length,
      medium: items.filter(i => i.predictionConfidence === PredictionConfidence.MEDIUM).length,
      low: items.filter(i => i.predictionConfidence === PredictionConfidence.LOW).length,
      none: items.filter(i => i.predictionConfidence === PredictionConfidence.NONE).length
    };
  }
  
  /**
   * Create API error
   */
  private createError(code: ErrorCode, message: string): ApiError {
    return { code, message };
  }

  /**
   * Get all distinct household IDs
   * Used by batch jobs to process all households
   */
  async getDistinctHouseholdIds(): Promise<string[]> {
    const container = await this.getContainer();
    
    const query = {
      query: 'SELECT DISTINCT VALUE c.householdId FROM c'
    };
    
    const { resources } = await container.items.query<string>(query).fetchAll();
    return resources;
  }
}

// Singleton instance
let itemRepositoryInstance: ItemRepository | null = null;

/**
 * Get or create Item repository instance
 */
export async function getItemRepository(): Promise<ItemRepository> {
  if (!itemRepositoryInstance) {
    itemRepositoryInstance = new ItemRepository();
    await itemRepositoryInstance.initialize();
  }
  return itemRepositoryInstance;
}
