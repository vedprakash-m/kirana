/**
 * Cost Tracking Service
 * 
 * Enforces LLM cost budgets at infrastructure level:
 * - User monthly cap: $0.20
 * - System daily cap: $50.00
 * 
 * Uses Cosmos DB for persistent tracking across cold starts.
 */

import { Container } from '@azure/cosmos';
import { CostTracking, ErrorCode, ApiError } from '../types/shared';
import { getCosmosDbService } from './cosmosDbService';

export interface BudgetStatus {
  allowed: boolean;
  userMonthlySpend: number;
  userMonthlyCap: number;
  systemDailySpend: number;
  systemDailyCap: number;
  message?: string;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export class CostTrackingService {
  private container: Container | null = null;
  
  // Cost configuration (from env vars)
  private readonly USER_MONTHLY_CAP = parseFloat(process.env.LLM_COST_PER_USER_MONTHLY || '0.20');
  private readonly SYSTEM_DAILY_CAP = parseFloat(process.env.LLM_COST_SYSTEM_DAILY || '50.00');
  private readonly COST_PER_1K_INPUT = parseFloat(process.env.LLM_COST_PER_1K_INPUT_TOKENS || '0.00001875');
  private readonly COST_PER_1K_OUTPUT = parseFloat(process.env.LLM_COST_PER_1K_OUTPUT_TOKENS || '0.000075');
  
  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    const cosmosService = await getCosmosDbService();
    this.container = cosmosService.getCostTrackingContainer();
  }
  
  /**
   * Get container (ensures initialization)
   */
  private async getContainer(): Promise<Container> {
    if (!this.container) {
      await this.initialize();
    }
    if (!this.container) {
      throw new Error('CostTracking container not initialized');
    }
    return this.container;
  }
  
  /**
   * Estimate cost before making LLM call
   */
  estimateCost(inputTokens: number, outputTokens: number): CostEstimate {
    const inputCost = (inputTokens / 1000) * this.COST_PER_1K_INPUT;
    const outputCost = (outputTokens / 1000) * this.COST_PER_1K_OUTPUT;
    
    return {
      inputTokens,
      outputTokens,
      estimatedCost: inputCost + outputCost
    };
  }
  
  /**
   * Check if LLM call is allowed (pre-flight budget check)
   */
  async checkBudget(
    householdId: string,
    userId: string,
    estimatedCost: number
  ): Promise<BudgetStatus> {
    const container = await this.getContainer();
    
    // Get current month and day
    const now = new Date();
    const monthPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dayPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Check user monthly spend
    const userMonthlyId = `${householdId}_${userId}_${monthPeriod}`;
    const userMonthlySpend = await this.getCurrentSpend(container, userMonthlyId);
    
    // Check system daily spend
    const systemDailyId = `system_all_${dayPeriod}`;
    const systemDailySpend = await this.getCurrentSpend(container, systemDailyId);
    
    // Budget enforcement
    const userWouldExceed = (userMonthlySpend + estimatedCost) > this.USER_MONTHLY_CAP;
    const systemWouldExceed = (systemDailySpend + estimatedCost) > this.SYSTEM_DAILY_CAP;
    
    if (userWouldExceed) {
      return {
        allowed: false,
        userMonthlySpend,
        userMonthlyCap: this.USER_MONTHLY_CAP,
        systemDailySpend,
        systemDailyCap: this.SYSTEM_DAILY_CAP,
        message: `User monthly LLM budget exceeded ($${this.USER_MONTHLY_CAP}). Receipt queued for overnight processing.`
      };
    }
    
    if (systemWouldExceed) {
      return {
        allowed: false,
        userMonthlySpend,
        userMonthlyCap: this.USER_MONTHLY_CAP,
        systemDailySpend,
        systemDailyCap: this.SYSTEM_DAILY_CAP,
        message: `System daily LLM budget exceeded ($${this.SYSTEM_DAILY_CAP}). Receipt queued for off-peak processing.`
      };
    }
    
    return {
      allowed: true,
      userMonthlySpend,
      userMonthlyCap: this.USER_MONTHLY_CAP,
      systemDailySpend,
      systemDailyCap: this.SYSTEM_DAILY_CAP
    };
  }
  
  /**
   * Record actual LLM usage after successful call
   */
  async recordUsage(
    householdId: string,
    userId: string,
    inputTokens: number,
    outputTokens: number,
    actualCost: number
  ): Promise<void> {
    const container = await this.getContainer();
    
    const now = new Date();
    const monthPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dayPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Update user monthly tracking
    const userMonthlyId = `${householdId}_${userId}_${monthPeriod}`;
    await this.incrementCost(container, {
      id: userMonthlyId,
      householdId,
      userId,
      period: monthPeriod,
      periodType: 'monthly',
      llmCalls: 1,
      llmTokensIn: inputTokens,
      llmTokensOut: outputTokens,
      llmCostUSD: actualCost,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });
    
    // Update system daily tracking
    const systemDailyId = `system_all_${dayPeriod}`;
    await this.incrementCost(container, {
      id: systemDailyId,
      householdId: 'system',
      period: dayPeriod,
      periodType: 'daily',
      llmCalls: 1,
      llmTokensIn: inputTokens,
      llmTokensOut: outputTokens,
      llmCostUSD: actualCost,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });
    
    console.log(`💰 Recorded LLM usage: $${actualCost.toFixed(4)} (${inputTokens}/${outputTokens} tokens)`);
  }
  
  /**
   * Get current spend for a tracking entry
   */
  private async getCurrentSpend(container: Container, id: string): Promise<number> {
    try {
      const { resource } = await container.item(id, id.split('_')[0]).read<CostTracking>();
      return resource?.llmCostUSD || 0;
    } catch (error: any) {
      if (error.code === 404) {
        return 0; // No spending yet
      }
      throw error;
    }
  }
  
  /**
   * Increment cost tracking entry (upsert)
   */
  private async incrementCost(container: Container, entry: CostTracking): Promise<void> {
    try {
      // Try to read existing
      const { resource: existing } = await container.item(entry.id, entry.householdId).read<CostTracking>();
      
      if (existing) {
        // Update existing
        const updated: CostTracking = {
          ...existing,
          llmCalls: existing.llmCalls + entry.llmCalls,
          llmTokensIn: existing.llmTokensIn + entry.llmTokensIn,
          llmTokensOut: existing.llmTokensOut + entry.llmTokensOut,
          llmCostUSD: existing.llmCostUSD + entry.llmCostUSD,
          updatedAt: entry.updatedAt
        };
        
        await container.item(entry.id, entry.householdId).replace(updated);
      } else {
        // Create new
        await container.items.create(entry);
      }
    } catch (error: any) {
      if (error.code === 404) {
        // Doesn't exist, create new
        await container.items.create(entry);
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Get user's current monthly spend
   */
  async getUserMonthlySpend(householdId: string, userId: string): Promise<number> {
    const container = await this.getContainer();
    
    const now = new Date();
    const monthPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const userMonthlyId = `${householdId}_${userId}_${monthPeriod}`;
    
    return await this.getCurrentSpend(container, userMonthlyId);
  }
  
  /**
   * Get system's current daily spend
   */
  async getSystemDailySpend(): Promise<number> {
    const container = await this.getContainer();
    
    const now = new Date();
    const dayPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const systemDailyId = `system_all_${dayPeriod}`;
    
    return await this.getCurrentSpend(container, systemDailyId);
  }
  
  /**
   * Get cost tracking history for a user
   */
  async getUserHistory(householdId: string, userId: string, months: number = 3): Promise<CostTracking[]> {
    const container = await this.getContainer();
    
    const query = `
      SELECT * FROM c 
      WHERE c.householdId = @householdId 
        AND c.userId = @userId
        AND c.periodType = 'monthly'
      ORDER BY c.period DESC
    `;
    
    try {
      const { resources } = await container.items
        .query<CostTracking>({
          query,
          parameters: [
            { name: '@householdId', value: householdId },
            { name: '@userId', value: userId }
          ]
        })
        .fetchAll();
      
      return resources.slice(0, months);
    } catch (error: any) {
      throw this.createError(ErrorCode.DATABASE_ERROR, `Failed to get cost history: ${error.message}`);
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
let costTrackingServiceInstance: CostTrackingService | null = null;

/**
 * Get or create Cost Tracking service instance
 */
export async function getCostTrackingService(): Promise<CostTrackingService> {
  if (!costTrackingServiceInstance) {
    costTrackingServiceInstance = new CostTrackingService();
    await costTrackingServiceInstance.initialize();
  }
  return costTrackingServiceInstance;
}
