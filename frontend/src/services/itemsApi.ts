/**
 * Items API Service
 * 
 * Service layer for item-related API calls.
 * Handles all CRUD operations for items.
 */

import { apiClient } from './api';
import type { Item, CreateItemDto, UpdateItemDto } from '../types/shared';

export interface ListItemsParams {
  householdId: string;
  sortBy?: 'name' | 'lastPurchaseDate' | 'predictedRunOutDate';
  sortOrder?: 'asc' | 'desc';
}

export interface ItemStats {
  total: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  noConfidence: number;
}

class ItemsApiService {
  /**
   * List all items for a household
   */
  async list(params: ListItemsParams): Promise<Item[]> {
    const queryParams = new URLSearchParams({
      householdId: params.householdId,
    });

    if (params.sortBy) {
      queryParams.append('sortBy', params.sortBy);
    }
    if (params.sortOrder) {
      queryParams.append('sortOrder', params.sortOrder);
    }

    return apiClient.get<Item[]>(`/items?${queryParams.toString()}`);
  }

  /**
   * Get a single item by ID
   */
  async get(id: string, householdId: string): Promise<Item> {
    return apiClient.get<Item>(`/items/${id}?householdId=${householdId}`);
  }

  /**
   * Create a new item
   */
  async create(item: CreateItemDto): Promise<Item> {
    return apiClient.post<Item>('/items', item);
  }

  /**
   * Update an existing item
   */
  async update(id: string, item: UpdateItemDto, etag?: string): Promise<Item> {
    const config = etag ? { headers: { 'If-Match': etag } } : undefined;
    return apiClient.put<Item>(`/items/${id}`, item, config);
  }

  /**
   * Delete an item (soft delete)
   */
  async delete(id: string, householdId: string): Promise<void> {
    return apiClient.delete<void>(`/items/${id}?householdId=${householdId}`);
  }

  /**
   * Get items running out soon
   */
  async getRunningOutSoon(householdId: string, days: number = 7): Promise<Item[]> {
    return apiClient.get<Item[]>(`/items/running-out?householdId=${householdId}&days=${days}`);
  }

  /**
   * Get items with low confidence predictions
   */
  async getLowConfidence(householdId: string): Promise<Item[]> {
    return apiClient.get<Item[]>(`/items/low-confidence?householdId=${householdId}`);
  }

  /**
   * Get confidence statistics
   */
  async getStats(householdId: string): Promise<ItemStats> {
    return apiClient.get<ItemStats>(`/items/stats?householdId=${householdId}`);
  }

  /**
   * Search items by name or brand
   */
  async search(householdId: string, query: string): Promise<Item[]> {
    return apiClient.get<Item[]>(`/items/search?householdId=${householdId}&q=${encodeURIComponent(query)}`);
  }

  /**
   * Create a teach mode item with frequency-based prediction
   */
  async createTeachModeItem(data: {
    userId: string;
    householdId: string;
    itemName: string;
    category: string;
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    lastPurchaseDate: string;
  }): Promise<Item> {
    return apiClient.post<Item>('/items/teach-mode', data);
  }
}

export const itemsApi = new ItemsApiService();
