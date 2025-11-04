/**
 * Gemini API Client with Cost Tracking
 * 
 * Provides structured LLM calls with:
 * - Pre-flight budget checks (CRITICAL: enforces $0.20/user/month, $50/day system caps)
 * - Automatic cost logging to Cosmos DB
 * - Quota error handling (429 → queue for batch processing)
 * - JSON schema validation for structured outputs
 * 
 * Model: gemini-2.0-flash-exp (latest, most cost-effective)
 * Temperature: 0.1 (low for consistency)
 * 
 * Usage:
 * const client = new GeminiClient();
 * await client.initialize();
 * const result = await client.generateStructured<ParsedItem>(
 *   householdId, userId, prompt, schema, estimatedTokens
 * );
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { CostTrackingService } from './costTrackingService';
import { ErrorCode } from '../types/shared';

/**
 * Custom error class for Gemini API operations
 */
export class GeminiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

export interface StructuredGenerationResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  cached: boolean;
}

export interface VisionGenerationResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

/**
 * Gemini API Client
 */
export class GeminiClient {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private costService: CostTrackingService;
  
  private readonly MODEL_NAME = 'gemini-2.0-flash-exp';
  private readonly DEFAULT_TEMPERATURE = 0.1;
  private readonly DEFAULT_MAX_TOKENS = 2048;
  
  constructor() {
    this.costService = new CostTrackingService();
  }
  
  /**
   * Initialize client (must be called before use)
   */
  async initialize(): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable not set');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: this.MODEL_NAME,
      generationConfig: {
        temperature: this.DEFAULT_TEMPERATURE,
        maxOutputTokens: this.DEFAULT_MAX_TOKENS,
        responseMimeType: 'application/json'
      }
    });
    
    await this.costService.initialize();
    console.log(`✅ GeminiClient initialized (model: ${this.MODEL_NAME})`);
  }
  
  /**
   * Generate structured JSON output with schema validation
   * 
   * @param householdId - For cost tracking
   * @param userId - For cost tracking
   * @param prompt - User prompt
   * @param schema - JSON schema for response format
   * @param estimatedInputTokens - Estimated input tokens for budget check
   * @param options - Generation options
   * @returns Parsed JSON data + cost metrics
   * 
   * @throws ApiError with BUDGET_EXCEEDED if pre-flight check fails
   * @throws ApiError with QUOTA_EXCEEDED on 429 (queue for batch processing)
   */
  async generateStructured<T>(
    householdId: string,
    userId: string,
    prompt: string,
    schema: object,
    estimatedInputTokens: number,
    options?: GeminiOptions
  ): Promise<StructuredGenerationResult<T>> {
    if (!this.model) {
      throw new Error('GeminiClient not initialized. Call initialize() first.');
    }
    
    // 🔴 CRITICAL: Pre-flight budget check
    const estimatedOutputTokens = options?.maxOutputTokens || this.DEFAULT_MAX_TOKENS;
    const estimate = this.costService.estimateCost(estimatedInputTokens, estimatedOutputTokens);
    
    const budgetStatus = await this.costService.checkBudget(
      householdId,
      userId,
      estimate.estimatedCost
    );
    
    if (!budgetStatus.allowed) {
      throw new GeminiError(
        ErrorCode.LLM_COST_EXCEEDED,
        budgetStatus.message || 'LLM budget exceeded',
        503,
        {
          userMonthlySpend: budgetStatus.userMonthlySpend,
          userMonthlyCap: budgetStatus.userMonthlyCap,
          systemDailySpend: budgetStatus.systemDailySpend,
          systemDailyCap: budgetStatus.systemDailyCap
        }
      );
    }
    
    // Add schema to prompt
    const enhancedPrompt = `${prompt}\n\nRespond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`;
    
    try {
      // Generate content
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? this.DEFAULT_TEMPERATURE,
          maxOutputTokens: options?.maxOutputTokens ?? this.DEFAULT_MAX_TOKENS,
          topP: options?.topP,
          topK: options?.topK,
          responseMimeType: 'application/json'
        }
      });
      
      const response = result.response;
      const text = response.text();
      
      // Extract token counts
      const usageMetadata = response.usageMetadata;
      const inputTokens = usageMetadata?.promptTokenCount || estimatedInputTokens;
      const outputTokens = usageMetadata?.candidatesTokenCount || 0;
      
      // Calculate actual cost
      const actualCost = this.costService.estimateCost(inputTokens, outputTokens).estimatedCost;
      
      // Record usage
      await this.costService.recordUsage(
        householdId,
        userId,
        inputTokens,
        outputTokens,
        actualCost
      );
      
      // Parse JSON
      let parsedData: T;
      try {
        parsedData = JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse LLM JSON response:', text);
        throw new GeminiError(
          ErrorCode.PARSING_FAILED,
          'LLM returned invalid JSON',
          500,
          { rawResponse: text }
        );
      }
      
      console.log(`✅ Gemini generateStructured: ${inputTokens}/${outputTokens} tokens, $${actualCost.toFixed(4)}`);
      
      return {
        data: parsedData,
        inputTokens,
        outputTokens,
        cost: actualCost,
        cached: false
      };
      
    } catch (error: any) {
      // Handle quota errors (429)
      if (error.status === 429 || error.message?.includes('quota')) {
        console.error('⚠️ Gemini quota exceeded (429). Queue for batch processing.');
        throw new GeminiError(
          ErrorCode.LLM_QUOTA_EXCEEDED,
          'LLM quota exceeded. Request queued for batch processing.',
          429,
          { retryAfter: 3600 } // 1 hour
        );
      }
      
      // Re-throw ApiErrors
      if (error instanceof GeminiError) {
        throw error;
      }
      
      // Generic LLM error
      console.error('Gemini API error:', error);
      throw new GeminiError(
        ErrorCode.GEMINI_API_ERROR,
        `Gemini API error: ${error.message}`,
        500,
        { originalError: error.message }
      );
    }
  }
  
  /**
   * Generate content from text + image (for OCR/receipt parsing)
   * 
   * @param householdId - For cost tracking
   * @param userId - For cost tracking
   * @param prompt - User prompt
   * @param imageData - Base64-encoded image data
   * @param mimeType - Image MIME type (image/jpeg, image/png, etc.)
   * @param estimatedInputTokens - Estimated input tokens (text + image)
   * @param options - Generation options
   * @returns Text response + cost metrics
   * 
   * @throws ApiError with BUDGET_EXCEEDED if pre-flight check fails
   * @throws ApiError with QUOTA_EXCEEDED on 429
   */
  async generateWithVision(
    householdId: string,
    userId: string,
    prompt: string,
    imageData: string,
    mimeType: string,
    estimatedInputTokens: number,
    options?: GeminiOptions
  ): Promise<VisionGenerationResult> {
    if (!this.model) {
      throw new Error('GeminiClient not initialized. Call initialize() first.');
    }
    
    // 🔴 CRITICAL: Pre-flight budget check
    const estimatedOutputTokens = options?.maxOutputTokens || this.DEFAULT_MAX_TOKENS;
    const estimate = this.costService.estimateCost(estimatedInputTokens, estimatedOutputTokens);
    
    const budgetStatus = await this.costService.checkBudget(
      householdId,
      userId,
      estimate.estimatedCost
    );
    
    if (!budgetStatus.allowed) {
      throw new GeminiError(
        ErrorCode.LLM_COST_EXCEEDED,
        budgetStatus.message || 'LLM budget exceeded',
        503,
        {
          userMonthlySpend: budgetStatus.userMonthlySpend,
          userMonthlyCap: budgetStatus.userMonthlyCap,
          systemDailySpend: budgetStatus.systemDailySpend,
          systemDailyCap: budgetStatus.systemDailyCap
        }
      );
    }
    
    try {
      // Generate content with vision
      const result = await this.model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: imageData
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: options?.temperature ?? this.DEFAULT_TEMPERATURE,
          maxOutputTokens: options?.maxOutputTokens ?? this.DEFAULT_MAX_TOKENS,
          topP: options?.topP,
          topK: options?.topK
        }
      });
      
      const response = result.response;
      const text = response.text();
      
      // Extract token counts
      const usageMetadata = response.usageMetadata;
      const inputTokens = usageMetadata?.promptTokenCount || estimatedInputTokens;
      const outputTokens = usageMetadata?.candidatesTokenCount || 0;
      
      // Calculate actual cost
      const actualCost = this.costService.estimateCost(inputTokens, outputTokens).estimatedCost;
      
      // Record usage
      await this.costService.recordUsage(
        householdId,
        userId,
        inputTokens,
        outputTokens,
        actualCost
      );
      
      console.log(`✅ Gemini generateWithVision: ${inputTokens}/${outputTokens} tokens, $${actualCost.toFixed(4)}`);
      
      return {
        text,
        inputTokens,
        outputTokens,
        cost: actualCost
      };
      
    } catch (error: any) {
      // Handle quota errors (429)
      if (error.status === 429 || error.message?.includes('quota')) {
        console.error('⚠️ Gemini quota exceeded (429). Queue for batch processing.');
        throw new GeminiError(
          ErrorCode.LLM_QUOTA_EXCEEDED,
          'LLM quota exceeded. Request queued for batch processing.',
          429,
          { retryAfter: 3600 } // 1 hour
        );
      }
      
      // Re-throw ApiErrors
      if (error instanceof GeminiError) {
        throw error;
      }
      
      // Generic LLM error
      console.error('Gemini API error:', error);
      throw new GeminiError(
        ErrorCode.GEMINI_API_ERROR,
        `Gemini API error: ${error.message}`,
        500,
        { originalError: error.message }
      );
    }
  }
  
  /**
   * Get singleton instance (lazy initialization)
   */
  private static instance: GeminiClient | null = null;
  
  static async getInstance(): Promise<GeminiClient> {
    if (!this.instance) {
      this.instance = new GeminiClient();
      await this.instance.initialize();
    }
    return this.instance;
  }
}

/**
 * Get initialized GeminiClient singleton
 */
export async function getGeminiClient(): Promise<GeminiClient> {
  return GeminiClient.getInstance();
}
