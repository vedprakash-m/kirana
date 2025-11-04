/**
 * Analytics Service
 * 
 * Tracks key activation milestones and user paths for measuring Time-to-Value (TTV).
 * PRD Section 1.3: Target 60% of users reach first_prediction_generated within 5 minutes (300 seconds).
 * 
 * All events stored in 'events' container with TTL 90 days for analysis.
 */

import { getCosmosDbService } from './cosmosDbService';

// Activation milestone event types
export enum ActivationMilestone {
  FIRST_ITEM_ADDED = 'first_item_added',
  FIRST_PREDICTION_GENERATED = 'first_prediction_generated',
  FIRST_RESTOCK_LOGGED = 'first_restock_logged',
  CSV_UPLOADED = 'csv_uploaded',
  ACCOUNT_CREATED = 'account_created',
}

// User activation paths
export enum ActivationPath {
  TEACH_ONLY = 'Teach-Only',           // Completed Teach Mode, no CSV uploaded
  CSV_PLUS_TEACH = 'CSV+Teach',        // Did Teach Mode while waiting for CSV
  CSV_ONLY = 'CSV-Only',               // Uploaded CSV directly, skipped Teach Mode
  DEMO = 'Demo',                       // Tried Demo Mode first
}

// Event source for first item
export enum FirstItemSource {
  TEACH_MODE = 'teach_mode',
  CSV_IMPORT = 'csv_import',
  MANUAL_ENTRY = 'manual_entry',
  DEMO = 'demo',
}

interface ActivationEvent {
  id: string;
  userId: string;
  householdId: string;
  eventType: string;  // 'activation_event'
  milestone: ActivationMilestone;
  timestamp: string;  // ISO 8601
  
  // Time-to-Value tracking
  timeToValueSeconds?: number;  // Seconds from account creation to this milestone
  
  // Path tracking
  activationPath?: ActivationPath;
  
  // Event-specific metadata
  source?: FirstItemSource;
  itemCount?: number;
  confidence?: string;
  rowCount?: number;
  parseSuccessRate?: number;
  
  // Cosmos DB fields
  ttl: number;  // 90 days = 7776000 seconds
  _ts?: number;
}

class AnalyticsService {
  private readonly TTL_90_DAYS = 90 * 24 * 60 * 60;  // 7776000 seconds

  /**
   * Track an activation milestone event
   */
  async trackMilestone(data: {
    userId: string;
    householdId: string;
    milestone: ActivationMilestone;
    source?: FirstItemSource;
    itemCount?: number;
    confidence?: string;
    rowCount?: number;
    parseSuccessRate?: number;
  }): Promise<void> {
    try {
      const cosmosDb = await getCosmosDbService();
      const container = cosmosDb.getEventsContainer();
      
      const timestamp = new Date().toISOString();

      // Create event
      const event: ActivationEvent = {
        id: `${data.userId}-${data.milestone}-${Date.now()}`,
        userId: data.userId,
        householdId: data.householdId,
        eventType: 'activation_event',
        milestone: data.milestone,
        timestamp,
        source: data.source,
        itemCount: data.itemCount,
        confidence: data.confidence,
        rowCount: data.rowCount,
        parseSuccessRate: data.parseSuccessRate,
        ttl: this.TTL_90_DAYS,
      };

      // Store event
      await container.items.create(event);

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Activation milestone tracked:', {
          milestone: data.milestone,
          userId: data.userId,
        });
      }
    } catch (error) {
      console.error('Error tracking activation milestone:', error);
      // Don't throw - analytics failures shouldn't break user flow
    }
  }

  /**
   * Get all activation events for a user
   */
  async getUserActivationEvents(userId: string): Promise<ActivationEvent[]> {
    try {
      const cosmosDb = await getCosmosDbService();
      const container = cosmosDb.getEventsContainer();
      
      const query = {
        query: 'SELECT * FROM c WHERE c.eventType = @eventType AND c.userId = @userId ORDER BY c.timestamp ASC',
        parameters: [
          { name: '@eventType', value: 'activation_event' },
          { name: '@userId', value: userId },
        ],
      };

      const { resources } = await container.items.query<ActivationEvent>(query).fetchAll();
      return resources;
    } catch (error) {
      console.error('Error getting user activation events:', error);
      return [];
    }
  }

  /**
   * Get activation funnel metrics
   */
  async getActivationFunnel(): Promise<{
    totalUsers: number;
    firstItemAdded: number;
    firstPrediction: number;
    firstRestock: number;
    csvUploaded: number;
    conversionRates: {
      itemAdded: number;
      predictionGenerated: number;
      restockLogged: number;
      csvUploaded: number;
    };
  }> {
    try {
      const cosmosDb = await getCosmosDbService();
      const container = cosmosDb.getEventsContainer();
      
      const query = {
        query: 'SELECT c.userId, c.milestone FROM c WHERE c.eventType = @eventType',
        parameters: [{ name: '@eventType', value: 'activation_event' }],
      };

      const { resources } = await container.items.query<{ userId: string; milestone: ActivationMilestone }>(query).fetchAll();
      
      // Count unique users who reached each milestone
      const usersByMilestone = new Map<ActivationMilestone, Set<string>>();
      const allUsers = new Set<string>();

      for (const event of resources) {
        allUsers.add(event.userId);
        
        if (!usersByMilestone.has(event.milestone)) {
          usersByMilestone.set(event.milestone, new Set());
        }
        usersByMilestone.get(event.milestone)!.add(event.userId);
      }

      const totalUsers = allUsers.size;
      const firstItemAdded = usersByMilestone.get(ActivationMilestone.FIRST_ITEM_ADDED)?.size || 0;
      const firstPrediction = usersByMilestone.get(ActivationMilestone.FIRST_PREDICTION_GENERATED)?.size || 0;
      const firstRestock = usersByMilestone.get(ActivationMilestone.FIRST_RESTOCK_LOGGED)?.size || 0;
      const csvUploaded = usersByMilestone.get(ActivationMilestone.CSV_UPLOADED)?.size || 0;

      return {
        totalUsers,
        firstItemAdded,
        firstPrediction,
        firstRestock,
        csvUploaded,
        conversionRates: {
          itemAdded: totalUsers > 0 ? (firstItemAdded / totalUsers) * 100 : 0,
          predictionGenerated: totalUsers > 0 ? (firstPrediction / totalUsers) * 100 : 0,
          restockLogged: totalUsers > 0 ? (firstRestock / totalUsers) * 100 : 0,
          csvUploaded: totalUsers > 0 ? (csvUploaded / totalUsers) * 100 : 0,
        },
      };
    } catch (error) {
      console.error('Error getting activation funnel:', error);
      return {
        totalUsers: 0,
        firstItemAdded: 0,
        firstPrediction: 0,
        firstRestock: 0,
        csvUploaded: 0,
        conversionRates: {
          itemAdded: 0,
          predictionGenerated: 0,
          restockLogged: 0,
          csvUploaded: 0,
        },
      };
    }
  }
}

export const analyticsService = new AnalyticsService();
export { ActivationEvent };
