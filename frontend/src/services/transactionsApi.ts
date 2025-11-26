/**
 * Transactions API Service
 * 
 * Service layer for transaction-related API calls.
 * Handles purchase history and One-Tap Restock.
 */

import { apiClient } from './api';
import type { Transaction, CreateTransactionDto, OneTapRestockDto } from '../types/shared';

export interface ListTransactionsParams {
  householdId: string;
  itemId?: string;
  limit?: number;
}

class TransactionsApiService {
  /**
   * List transactions
   */
  async list(params: ListTransactionsParams): Promise<Transaction[]> {
    const queryParams = new URLSearchParams({
      householdId: params.householdId,
    });

    if (params.itemId) {
      queryParams.append('itemId', params.itemId);
    }
    if (params.limit) {
      queryParams.append('limit', params.limit.toString());
    }

    return apiClient.get<Transaction[]>(`/transactions?${queryParams.toString()}`);
  }

  /**
   * Create a new transaction
   */
  async create(transaction: CreateTransactionDto): Promise<Transaction> {
    return apiClient.post<Transaction>('/transactions', transaction);
  }

  /**
   * One-Tap Restock - Quick restock using last purchase details
   */
  async restock(data: OneTapRestockDto): Promise<Transaction> {
    return apiClient.post<Transaction>('/transactions/restock', data);
  }

  /**
   * Get transaction by ID
   */
  async get(id: string, householdId: string): Promise<Transaction> {
    return apiClient.get<Transaction>(`/transactions/${id}?householdId=${householdId}`);
  }

  /**
   * Get transactions for a specific item
   */
  async getForItem(itemId: string, householdId: string, limit = 10): Promise<Transaction[]> {
    return this.list({ householdId, itemId, limit });
  }
}

// Export singleton instance
export const transactionsApi = new TransactionsApiService();
