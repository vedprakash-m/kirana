/**
 * Transaction Repository
 * 
 * Data access layer for Transaction entities in Cosmos DB.
 * Handles purchase history tracking and queries.
 */

import { Container } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import { 
  Transaction, 
  CreateTransactionDto,
  ApiError,
  ErrorCode 
} from '../types/shared';
import { getCosmosDbService } from '../services/cosmosDbService';

export class TransactionRepository {
  private container: Container | null = null;
  
  /**
   * Initialize repository
   */
  async initialize(): Promise<void> {
    const cosmosService = await getCosmosDbService();
    this.container = cosmosService.getTransactionsContainer();
  }
  
  /**
   * Get container (ensures initialization)
   */
  private async getContainer(): Promise<Container> {
    if (!this.container) {
      await this.initialize();
    }
    if (!this.container) {
      throw new Error('Transaction container not initialized');
    }
    return this.container;
  }
  
  /**
   * Create a new transaction
   */
  async create(
    householdId: string,
    userId: string,
    dto: CreateTransactionDto
  ): Promise<Transaction> {
    const container = await this.getContainer();
    
    // Validate quantity and price
    if (dto.quantity <= 0) {
      throw this.createError(ErrorCode.INVALID_QUANTITY, 'Quantity must be greater than 0');
    }
    if (dto.totalPrice < 0) {
      throw this.createError(ErrorCode.VALIDATION_ERROR, 'Total price cannot be negative');
    }
    
    // Validate purchase date
    const purchaseDate = new Date(dto.purchaseDate);
    const now = new Date();
    if (purchaseDate > now) {
      throw this.createError(ErrorCode.INVALID_DATE, 'Purchase date cannot be in the future');
    }
    
    const transaction: Transaction = {
      id: uuidv4(),
      householdId,
      itemId: dto.itemId,
      
      // Purchase Details
      purchaseDate: dto.purchaseDate,
      quantity: dto.quantity,
      totalPrice: dto.totalPrice,
      unitPrice: dto.totalPrice / dto.quantity,
      vendor: dto.vendor,
      
      // Source Metadata
      source: dto.source,
      sourceMetadata: dto.sourceMetadata || {},
      
      // Metadata
      createdAt: new Date().toISOString(),
      createdBy: userId
    };
    
    try {
      const { resource } = await container.items.create(transaction);
      return resource as Transaction;
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to create transaction: ${error.message}`);
    }
  }
  
  /**
   * Get transaction by ID
   */
  async getById(transactionId: string, householdId: string): Promise<Transaction | null> {
    const container = await this.getContainer();
    
    try {
      const { resource } = await container.item(transactionId, householdId).read<Transaction>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to get transaction: ${error.message}`);
    }
  }
  
  /**
   * Get all transactions for an item
   */
  async getByItem(itemId: string, householdId: string): Promise<Transaction[]> {
    const container = await this.getContainer();
    
    const query = `
      SELECT * FROM c 
      WHERE c.householdId = @householdId 
        AND c.itemId = @itemId
      ORDER BY c.purchaseDate DESC
    `;
    
    try {
      const { resources } = await container.items
        .query<Transaction>({
          query,
          parameters: [
            { name: '@householdId', value: householdId },
            { name: '@itemId', value: itemId }
          ]
        })
        .fetchAll();
      
      return resources;
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to get transactions: ${error.message}`);
    }
  }
  
  /**
   * Get recent transactions for an item (last N months)
   */
  async getRecentByItem(
    itemId: string, 
    householdId: string, 
    months: number = 12
  ): Promise<Transaction[]> {
    const container = await this.getContainer();
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    const cutoffISO = cutoffDate.toISOString();
    
    const query = `
      SELECT * FROM c 
      WHERE c.householdId = @householdId 
        AND c.itemId = @itemId
        AND c.purchaseDate >= @cutoffDate
      ORDER BY c.purchaseDate DESC
    `;
    
    try {
      const { resources } = await container.items
        .query<Transaction>({
          query,
          parameters: [
            { name: '@householdId', value: householdId },
            { name: '@itemId', value: itemId },
            { name: '@cutoffDate', value: cutoffISO }
          ]
        })
        .fetchAll();
      
      return resources;
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to get recent transactions: ${error.message}`);
    }
  }
  
  /**
   * Get all transactions for a household
   */
  async getByHousehold(
    householdId: string,
    limit?: number
  ): Promise<Transaction[]> {
    const container = await this.getContainer();
    
    const query = limit
      ? `SELECT TOP @limit * FROM c WHERE c.householdId = @householdId ORDER BY c.purchaseDate DESC`
      : `SELECT * FROM c WHERE c.householdId = @householdId ORDER BY c.purchaseDate DESC`;
    
    const parameters = limit
      ? [
          { name: '@householdId', value: householdId },
          { name: '@limit', value: limit }
        ]
      : [{ name: '@householdId', value: householdId }];
    
    try {
      const { resources } = await container.items
        .query<Transaction>({ query, parameters })
        .fetchAll();
      
      return resources;
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to get household transactions: ${error.message}`);
    }
  }
  
  /**
   * Get transactions within a date range
   */
  async getByDateRange(
    householdId: string,
    startDate: string,
    endDate: string
  ): Promise<Transaction[]> {
    const container = await this.getContainer();
    
    const query = `
      SELECT * FROM c 
      WHERE c.householdId = @householdId 
        AND c.purchaseDate >= @startDate
        AND c.purchaseDate <= @endDate
      ORDER BY c.purchaseDate DESC
    `;
    
    try {
      const { resources } = await container.items
        .query<Transaction>({
          query,
          parameters: [
            { name: '@householdId', value: householdId },
            { name: '@startDate', value: startDate },
            { name: '@endDate', value: endDate }
          ]
        })
        .fetchAll();
      
      return resources;
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to get transactions by date range: ${error.message}`);
    }
  }
  
  /**
   * Get last purchase for an item
   */
  async getLastPurchase(itemId: string, householdId: string): Promise<Transaction | null> {
    const container = await this.getContainer();
    
    const query = `
      SELECT TOP 1 * FROM c 
      WHERE c.householdId = @householdId 
        AND c.itemId = @itemId
      ORDER BY c.purchaseDate DESC
    `;
    
    try {
      const { resources } = await container.items
        .query<Transaction>({
          query,
          parameters: [
            { name: '@householdId', value: householdId },
            { name: '@itemId', value: itemId }
          ]
        })
        .fetchAll();
      
      return resources.length > 0 ? resources[0] : null;
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to get last purchase: ${error.message}`);
    }
  }
  
  /**
   * Get purchase count for an item
   */
  async getPurchaseCount(itemId: string, householdId: string): Promise<number> {
    const transactions = await this.getByItem(itemId, householdId);
    return transactions.length;
  }
  
  /**
   * Calculate average purchase frequency (in days) for an item
   */
  async calculateAverageFrequency(itemId: string, householdId: string): Promise<number | null> {
    const transactions = await this.getByItem(itemId, householdId);
    
    if (transactions.length < 2) {
      return null;
    }
    
    // Sort by purchase date ascending
    const sorted = transactions.sort((a, b) => 
      new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
    );
    
    // Calculate intervals between purchases
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prevDate = new Date(sorted[i - 1].purchaseDate);
      const currDate = new Date(sorted[i].purchaseDate);
      const daysDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(daysDiff);
    }
    
    // Calculate average
    const sum = intervals.reduce((acc, val) => acc + val, 0);
    return sum / intervals.length;
  }
  
  /**
   * Get spending by vendor
   */
  async getSpendingByVendor(householdId: string, months: number = 3): Promise<Record<string, number>> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    const cutoffISO = cutoffDate.toISOString();
    
    const transactions = await this.getByDateRange(householdId, cutoffISO, new Date().toISOString());
    
    const spending: Record<string, number> = {};
    transactions.forEach(t => {
      const vendor = t.vendor;
      spending[vendor] = (spending[vendor] || 0) + t.totalPrice;
    });
    
    return spending;
  }
  
  /**
   * Delete a transaction (permanent)
   */
  async delete(transactionId: string, householdId: string): Promise<void> {
    const container = await this.getContainer();
    
    try {
      await container.item(transactionId, householdId).delete();
    } catch (error: any) {
      if (error.code === 404) {
        // Already deleted, no-op
        return;
      }
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to delete transaction: ${error.message}`);
    }
  }
  
  /**
   * Create API error
   */
  private createError(code: ErrorCode, message: string): ApiError {
    return { code, message };
  }
}

// Singleton instance
let transactionRepositoryInstance: TransactionRepository | null = null;

/**
 * Get or create Transaction repository instance
 */
export async function getTransactionRepository(): Promise<TransactionRepository> {
  if (!transactionRepositoryInstance) {
    transactionRepositoryInstance = new TransactionRepository();
    await transactionRepositoryInstance.initialize();
  }
  return transactionRepositoryInstance;
}
