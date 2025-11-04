/**
 * Normalization Cache Service
 * 
 * Two-tier caching for SKU normalization results:
 * - Tier 1: In-memory LRU cache (1000 items, <10ms lookups)
 * - Tier 2: Cosmos DB ('cache' container, 90-day TTL)
 * 
 * Target: 30-40% cache hit rate for common items
 * 
 * Key Generation: SHA-256 hash of `${rawText.toLowerCase()}_${retailer}`
 * 
 * Usage:
 * const cache = await getNormalizationCache();
 * const cached = await cache.get('milk whole 1gal', 'amazon');
 * if (!cached) {
 *   const result = await llmParse(...);
 *   await cache.set('milk whole 1gal', 'amazon', result);
 * }
 */

import { Container } from '@azure/cosmos';
import { createHash } from 'crypto';
import { getCosmosDbService } from './cosmosDbService';

/**
 * Normalized item data (result of LLM parsing)
 */
export interface NormalizedItem {
  canonicalName: string;
  brand?: string;
  category: string;
  quantity: number;
  unitOfMeasure: string;
  packageSize: number;
  packageUnit: string;
  confidence: number; // 0.0-1.0
}

/**
 * Cache entry structure (Cosmos DB document)
 */
interface CacheEntry {
  id: string; // SHA-256 hash key
  rawText: string;
  retailer: string;
  normalized: NormalizedItem;
  hitCount: number;
  lastAccessedAt: string; // ISO 8601
  createdAt: string; // ISO 8601
  ttl: number; // 90 days in seconds
}

/**
 * LRU Cache implementation
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly maxSize: number;
  
  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  
  set(key: K, value: V): void {
    // Remove if exists (to update position)
    this.cache.delete(key);
    
    // Add to end (most recently used)
    this.cache.set(key, value);
    
    // Evict oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }
  
  has(key: K): boolean {
    return this.cache.has(key);
  }
  
  size(): number {
    return this.cache.size;
  }
  
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Normalization Cache Service
 */
export class NormalizationCache {
  private container: Container | null = null;
  private memoryCache: LRUCache<string, NormalizedItem>;
  private readonly MEMORY_CACHE_SIZE = 1000;
  private readonly TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
  
  constructor() {
    this.memoryCache = new LRUCache(this.MEMORY_CACHE_SIZE);
  }
  
  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    const cosmosService = await getCosmosDbService();
    this.container = cosmosService.getCacheContainer();
    
    // Preload top items into memory cache
    await this.preloadTopItems();
    
    console.log(`✅ NormalizationCache initialized (memory: ${this.memoryCache.size()} items)`);
  }
  
  /**
   * Get container (ensures initialization)
   */
  private async getContainer(): Promise<Container> {
    if (!this.container) {
      await this.initialize();
    }
    if (!this.container) {
      throw new Error('Cache container not initialized');
    }
    return this.container;
  }
  
  /**
   * Generate cache key
   */
  private generateKey(rawText: string, retailer: string): string {
    const normalized = `${rawText.toLowerCase()}_${retailer.toLowerCase()}`;
    return createHash('sha256').update(normalized).digest('hex');
  }
  
  /**
   * Get cached normalization result
   * 
   * @param rawText - Raw text from CSV/receipt
   * @param retailer - Retailer name (amazon, costco, etc.)
   * @returns Normalized item data or undefined if not cached
   */
  async get(rawText: string, retailer: string): Promise<NormalizedItem | undefined> {
    const key = this.generateKey(rawText, retailer);
    
    // Try memory cache first (Tier 1)
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached) {
      console.log(`💰 Cache HIT (memory): ${rawText} @ ${retailer}`);
      
      // Update hitCount in background (don't await)
      this.incrementHitCount(key).catch(err => 
        console.error('Failed to increment hit count:', err)
      );
      
      return memoryCached;
    }
    
    // Try Cosmos DB (Tier 2)
    try {
      const container = await this.getContainer();
      const { resource } = await container.item(key, key).read<CacheEntry>();
      
      if (resource) {
        console.log(`💰 Cache HIT (cosmos): ${rawText} @ ${retailer}`);
        
        // Add to memory cache
        this.memoryCache.set(key, resource.normalized);
        
        // Update access time and hit count
        await this.incrementHitCount(key);
        
        return resource.normalized;
      }
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`❌ Cache MISS: ${rawText} @ ${retailer}`);
        return undefined;
      }
      console.error('Cache get error:', error);
      return undefined; // Fail gracefully
    }
    
    return undefined;
  }
  
  /**
   * Store normalization result in cache
   * 
   * @param rawText - Raw text from CSV/receipt
   * @param retailer - Retailer name
   * @param normalized - Normalized item data
   */
  async set(rawText: string, retailer: string, normalized: NormalizedItem): Promise<void> {
    const key = this.generateKey(rawText, retailer);
    const now = new Date().toISOString();
    
    // Add to memory cache
    this.memoryCache.set(key, normalized);
    
    // Persist to Cosmos DB
    try {
      const container = await this.getContainer();
      
      const entry: CacheEntry = {
        id: key,
        rawText,
        retailer,
        normalized,
        hitCount: 0,
        lastAccessedAt: now,
        createdAt: now,
        ttl: this.TTL_SECONDS
      };
      
      await container.items.upsert(entry);
      console.log(`✅ Cache SET: ${rawText} @ ${retailer}`);
    } catch (error: any) {
      console.error('Cache set error:', error);
      // Don't throw - cache failures shouldn't break the flow
    }
  }
  
  /**
   * Increment hit count for cache entry
   */
  private async incrementHitCount(key: string): Promise<void> {
    try {
      const container = await this.getContainer();
      const { resource } = await container.item(key, key).read<CacheEntry>();
      
      if (resource) {
        resource.hitCount++;
        resource.lastAccessedAt = new Date().toISOString();
        await container.item(key, key).replace(resource);
      }
    } catch (error: any) {
      // Silent failure - hit count is not critical
      console.error('Failed to increment hit count:', error);
    }
  }
  
  /**
   * Preload top 1000 items by hit count into memory cache
   */
  async preloadTopItems(): Promise<void> {
    try {
      const container = await this.getContainer();
      
      const query = {
        query: 'SELECT TOP 1000 * FROM c ORDER BY c.hitCount DESC',
      };
      
      const { resources } = await container.items.query<CacheEntry>(query).fetchAll();
      
      for (const entry of resources) {
        const key = entry.id;
        this.memoryCache.set(key, entry.normalized);
      }
      
      console.log(`✅ Preloaded ${resources.length} top items into memory cache`);
    } catch (error: any) {
      console.error('Failed to preload cache:', error);
      // Don't throw - service can still work without preload
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memorySize: number;
    memoryCapacity: number;
    totalEntries: number;
    topHits: Array<{ rawText: string; retailer: string; hitCount: number }>;
  }> {
    const container = await this.getContainer();
    
    // Count total entries
    const countQuery = {
      query: 'SELECT VALUE COUNT(1) FROM c'
    };
    const { resources: [totalEntries] } = await container.items.query<number>(countQuery).fetchAll();
    
    // Get top 10 hits
    const topHitsQuery = {
      query: 'SELECT TOP 10 c.rawText, c.retailer, c.hitCount FROM c ORDER BY c.hitCount DESC'
    };
    const { resources: topHits } = await container.items.query<any>(topHitsQuery).fetchAll();
    
    return {
      memorySize: this.memoryCache.size(),
      memoryCapacity: this.MEMORY_CACHE_SIZE,
      totalEntries: totalEntries || 0,
      topHits
    };
  }
  
  /**
   * Clear memory cache (for testing)
   */
  clearMemory(): void {
    this.memoryCache.clear();
  }
}

/**
 * Get singleton instance (lazy initialization)
 */
let instance: NormalizationCache | null = null;

export async function getNormalizationCache(): Promise<NormalizationCache> {
  if (!instance) {
    instance = new NormalizationCache();
    await instance.initialize();
  }
  return instance;
}
