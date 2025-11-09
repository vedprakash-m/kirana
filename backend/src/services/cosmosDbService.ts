/**
 * Cosmos DB Service
 * 
 * Provides a centralized service for interacting with Cosmos DB.
 * Handles connection initialization, error handling, and common operations.
 */

import { CosmosClient, Database, Container } from '@azure/cosmos';

export class CosmosDbService {
  private client: CosmosClient;
  private database: Database | null = null;
  
  // Container references
  private containers: {
    items?: Container;
    transactions?: Container;
    households?: Container;
    cache?: Container;
    parseJobs?: Container;
    events?: Container;
    costTracking?: Container;
    users?: Container;
    invitations?: Container;
    sessions?: Container;
  } = {};
  
  constructor() {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    
    if (!endpoint || !key) {
      throw new Error('Cosmos DB configuration missing. Please set COSMOS_ENDPOINT and COSMOS_KEY environment variables.');
    }
    
    this.client = new CosmosClient({ endpoint, key });
  }
  
  /**
   * Initialize database and container connections
   */
  async initialize(): Promise<void> {
    const databaseId = process.env.COSMOS_DATABASE_ID || 'kirana-dev';
    
    try {
      const { database } = await this.client.databases.createIfNotExists({ id: databaseId });
      this.database = database;
      
      // Initialize all containers
      this.containers.items = this.database.container('items');
      this.containers.transactions = this.database.container('transactions');
      this.containers.households = this.database.container('households');
      this.containers.cache = this.database.container('cache');
      this.containers.parseJobs = this.database.container('parseJobs');
      this.containers.events = this.database.container('events');
      this.containers.costTracking = this.database.container('costTracking');
      this.containers.users = this.database.container('users');
      this.containers.invitations = this.database.container('invitations');
      this.containers.sessions = this.database.container('sessions');
      
      console.log(`✅ Connected to Cosmos DB database: ${databaseId}`);
    } catch (error) {
      console.error('❌ Failed to initialize Cosmos DB:', error);
      throw error;
    }
  }
  
  /**
   * Get Items container
   */
  getItemsContainer(): Container {
    if (!this.containers.items) {
      throw new Error('Items container not initialized. Call initialize() first.');
    }
    return this.containers.items;
  }
  
  /**
   * Get Transactions container
   */
  getTransactionsContainer(): Container {
    if (!this.containers.transactions) {
      throw new Error('Transactions container not initialized. Call initialize() first.');
    }
    return this.containers.transactions;
  }
  
  /**
   * Get Households container
   */
  getHouseholdsContainer(): Container {
    if (!this.containers.households) {
      throw new Error('Households container not initialized. Call initialize() first.');
    }
    return this.containers.households;
  }
  
  /**
   * Get Cache container
   */
  getCacheContainer(): Container {
    if (!this.containers.cache) {
      throw new Error('Cache container not initialized. Call initialize() first.');
    }
    return this.containers.cache;
  }
  
  /**
   * Get ParseJobs container
   */
  getParseJobsContainer(): Container {
    if (!this.containers.parseJobs) {
      throw new Error('ParseJobs container not initialized. Call initialize() first.');
    }
    return this.containers.parseJobs;
  }
  
  /**
   * Get Events container
   */
  getEventsContainer(): Container {
    if (!this.containers.events) {
      throw new Error('Events container not initialized. Call initialize() first.');
    }
    return this.containers.events;
  }
  
  /**
   * Get CostTracking container
   */
  getCostTrackingContainer(): Container {
    if (!this.containers.costTracking) {
      throw new Error('CostTracking container not initialized. Call initialize() first.');
    }
    return this.containers.costTracking;
  }
  
  /**
   * Get Users container
   */
  getUsersContainer(): Container {
    if (!this.containers.users) {
      throw new Error('Users container not initialized. Call initialize() first.');
    }
    return this.containers.users;
  }
  
  /**
   * Get Invitations container (Phase 2.2)
   */
  getInvitationsContainer(): Container {
    if (!this.containers.invitations) {
      throw new Error('Invitations container not initialized. Call initialize() first.');
    }
    return this.containers.invitations;
  }
  
  /**
   * Get Sessions container (Phase 2.3)
   */
  getSessionsContainer(): Container {
    if (!this.containers.sessions) {
      throw new Error('Sessions container not initialized. Call initialize() first.');
    }
    return this.containers.sessions;
  }
  
  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.database !== null && Object.keys(this.containers).length === 10;
  }
}

// Singleton instance
let cosmosDbServiceInstance: CosmosDbService | null = null;

/**
 * Get or create Cosmos DB service instance
 */
export async function getCosmosDbService(): Promise<CosmosDbService> {
  if (!cosmosDbServiceInstance) {
    cosmosDbServiceInstance = new CosmosDbService();
    await cosmosDbServiceInstance.initialize();
  }
  return cosmosDbServiceInstance;
}
