/**
 * Items Store (Zustand)
 * 
 * Global state management for items with offline-first approach.
 * Syncs with IndexedDB and backend API.
 */

import { create } from 'zustand';
import { itemsApi } from '../services/itemsApi';
import { db } from '../services/db';
import type { Item, CreateItemDto, UpdateItemDto } from '../types/shared';

interface ItemsState {
  // State
  items: Item[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  error: string | null;
  householdId: string | null;

  // Actions
  setHouseholdId: (householdId: string) => void;
  loadItems: () => Promise<void>;
  syncItems: () => Promise<void>;
  createItem: (item: CreateItemDto) => Promise<Item>;
  updateItem: (id: string, item: UpdateItemDto, etag?: string) => Promise<Item>;
  deleteItem: (id: string) => Promise<void>;
  getRunningOutSoon: (days?: number) => Promise<Item[]>;
  getLowConfidence: () => Promise<Item[]>;
  clearError: () => void;
}

export const useItemsStore = create<ItemsState>((set, get) => ({
  // Initial state
  items: [],
  isLoading: false,
  isSyncing: false,
  lastSync: null,
  error: null,
  householdId: null,

  /**
   * Set household ID
   */
  setHouseholdId: (householdId: string) => {
    set({ householdId });
  },

  /**
   * Load items from IndexedDB (fast, offline-first)
   */
  loadItems: async () => {
    const { householdId } = get();
    if (!householdId) {
      set({ error: 'No household selected' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Load from IndexedDB first (instant)
      const cachedItems = await db.getItemsByHousehold(householdId);
      set({ items: cachedItems, isLoading: false });

      // Then sync with backend in background
      get().syncItems();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load items',
        isLoading: false 
      });
    }
  },

  /**
   * Sync items with backend API
   */
  syncItems: async () => {
    const { householdId } = get();
    if (!householdId) return;

    set({ isSyncing: true, error: null });

    try {
      // Fetch from backend
      const items = await itemsApi.list({ householdId });

      // Save to IndexedDB
      await db.saveItems(items);

      // Update state
      set({ 
        items,
        isSyncing: false,
        lastSync: new Date()
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to sync items',
        isSyncing: false 
      });
    }
  },

  /**
   * Create a new item
   */
  createItem: async (itemData: CreateItemDto) => {
    set({ error: null });

    try {
      // Try to create on backend
      const newItem = await itemsApi.create(itemData);

      // Save to IndexedDB
      await db.saveItem(newItem);

      // Update state
      set(state => ({
        items: [...state.items, newItem]
      }));

      return newItem;
    } catch (error) {
      // Queue for later if offline
      await db.queueSync({
        type: 'create',
        entity: 'item',
        data: itemData
      });

      throw error;
    }
  },

  /**
   * Update an existing item
   */
  updateItem: async (id: string, itemData: UpdateItemDto, etag?: string) => {
    set({ error: null });

    try {
      // Update on backend
      const updatedItem = await itemsApi.update(id, itemData, etag);

      // Save to IndexedDB
      await db.saveItem(updatedItem);

      // Update state
      set(state => ({
        items: state.items.map(item => 
          item.id === id ? updatedItem : item
        )
      }));

      return updatedItem;
    } catch (error) {
      // Queue for later if offline
      await db.queueSync({
        type: 'update',
        entity: 'item',
        data: { id, ...itemData }
      });

      throw error;
    }
  },

  /**
   * Delete an item (soft delete)
   */
  deleteItem: async (id: string) => {
    const { householdId } = get();
    if (!householdId) return;

    set({ error: null });

    try {
      // Delete on backend
      await itemsApi.delete(id, householdId);

      // Remove from IndexedDB
      await db.deleteItem(id);

      // Update state
      set(state => ({
        items: state.items.filter(item => item.id !== id)
      }));
    } catch (error) {
      // Queue for later if offline
      await db.queueSync({
        type: 'delete',
        entity: 'item',
        data: { id, householdId }
      });

      throw error;
    }
  },

  /**
   * Get items running out soon
   */
  getRunningOutSoon: async (days = 7) => {
    const { householdId } = get();
    if (!householdId) return [];

    try {
      return await itemsApi.getRunningOutSoon(householdId, days);
    } catch {
      // Fallback to local filtering if offline
      const { items } = get();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + days);

      return items.filter(item => {
        if (!item.predictedRunOutDate) return false;
        const runOutDate = new Date(item.predictedRunOutDate);
        return runOutDate <= cutoffDate && runOutDate >= new Date();
      });
    }
  },

  /**
   * Get items with low confidence
   */
  getLowConfidence: async () => {
    const { householdId } = get();
    if (!householdId) return [];

    try {
      return await itemsApi.getLowConfidence(householdId);
    } catch {
      // Fallback to local filtering if offline
      const { items } = get();
      return items.filter(item => 
        item.predictionConfidence === 'Low'
      );
    }
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null });
  },
}));
