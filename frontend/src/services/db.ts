/**
 * IndexedDB Database Setup
 * 
 * Uses Dexie.js for IndexedDB management.
 * Stores items, transactions, and sync queue for offline support.
 */

import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Item, Transaction } from '../types/shared';

export interface SyncQueueEntry {
  id?: number;
  type: 'create' | 'update' | 'delete';
  entity: 'item' | 'transaction';
  data: unknown;
  timestamp: number;
  retryCount: number;
}

export class KiranaDatabase extends Dexie {
  // Tables
  items!: Table<Item, string>;
  transactions!: Table<Transaction, string>;
  syncQueue!: Table<SyncQueueEntry, number>;

  constructor() {
    super('KiranaDB');
    
    this.version(1).stores({
      items: 'id, householdId, canonicalName, category, predictedRunOutDate, lastPurchaseDate, deletedAt',
      transactions: 'id, householdId, itemId, purchaseDate, vendor',
      syncQueue: '++id, timestamp, type, entity',
    });
  }

  /**
   * Save items to IndexedDB
   */
  async saveItems(items: Item[]): Promise<void> {
    await this.items.bulkPut(items);
  }

  /**
   * Get items by household (excludes soft-deleted)
   */
  async getItemsByHousehold(householdId: string): Promise<Item[]> {
    return this.items
      .where('householdId')
      .equals(householdId)
      .and(item => !item.deletedAt)
      .toArray();
  }

  /**
   * Save a single item
   */
  async saveItem(item: Item): Promise<void> {
    await this.items.put(item);
  }

  /**
   * Delete an item from IndexedDB
   */
  async deleteItem(id: string): Promise<void> {
    await this.items.delete(id);
  }

  /**
   * Save transactions to IndexedDB
   */
  async saveTransactions(transactions: Transaction[]): Promise<void> {
    await this.transactions.bulkPut(transactions);
  }

  /**
   * Get transactions by item
   */
  async getTransactionsByItem(itemId: string): Promise<Transaction[]> {
    return this.transactions
      .where('itemId')
      .equals(itemId)
      .reverse()
      .sortBy('purchaseDate');
  }

  /**
   * Queue an operation for sync
   */
  async queueSync(entry: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    await this.syncQueue.add({
      ...entry,
      timestamp: Date.now(),
      retryCount: 0,
    });
  }

  /**
   * Get pending sync operations
   */
  async getSyncQueue(): Promise<SyncQueueEntry[]> {
    return this.syncQueue.toArray();
  }

  /**
   * Clear sync queue after successful sync
   */
  async clearSyncQueue(): Promise<void> {
    await this.syncQueue.clear();
  }

  /**
   * Remove a specific sync queue entry
   */
  async removeSyncEntry(id: number): Promise<void> {
    await this.syncQueue.delete(id);
  }

  /**
   * Increment retry count for a sync entry
   */
  async incrementRetryCount(id: number): Promise<void> {
    const entry = await this.syncQueue.get(id);
    if (entry) {
      entry.retryCount += 1;
      await this.syncQueue.put(entry);
    }
  }

  /**
   * Clear all data (for logout)
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.items.clear(),
      this.transactions.clear(),
      this.syncQueue.clear(),
    ]);
  }
}

// Export singleton instance
export const db = new KiranaDatabase();
