/**
 * Secrets Management with Azure Key Vault
 * 
 * Centralized secrets management using Azure Key Vault for all sensitive configuration.
 * 
 * Security Benefits:
 * - No secrets in code or git repository
 * - Centralized secret rotation
 * - Access audit logging
 * - RBAC-based access control
 * - Automatic secret versioning
 * 
 * Authentication:
 * - Local Development: Azure CLI credentials (az login)
 * - CI/CD: Service Principal with environment variables
 * - Production: Managed Identity (no credentials needed)
 * 
 * Usage:
 * ```typescript
 * import { initializeSecrets, getSecret } from './config/secrets';
 * 
 * // At startup
 * await initializeSecrets();
 * 
 * // Get secret
 * const apiKey = await getSecret('gemini-api-key');
 * ```
 */

import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * Secret names in Key Vault
 */
export const SECRET_NAMES = {
  GEMINI_API_KEY: 'gemini-api-key',
  COSMOS_CONNECTION_STRING: 'cosmos-connection-string',
  STORAGE_CONNECTION_STRING: 'storage-connection-string',
  ENTRA_CLIENT_SECRET: 'entra-client-secret',
  ENTRA_CLIENT_ID: 'entra-client-id',
  APPLICATION_INSIGHTS_KEY: 'application-insights-key'
} as const;

/**
 * Secret cache (in-memory for performance)
 * Secrets are cached for 5 minutes to reduce Key Vault API calls
 */
interface CachedSecret {
  value: string;
  expiresAt: number;
}

const secretCache = new Map<string, CachedSecret>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Key Vault client
 */
let keyVaultClient: SecretClient | null = null;

/**
 * Check if running in local development mode
 */
function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production' && !process.env.AZURE_FUNCTIONS_ENVIRONMENT;
}

/**
 * Initialize Key Vault client
 * 
 * Authentication methods (in order of precedence):
 * 1. Managed Identity (production - automatic)
 * 2. Service Principal (CI/CD - env vars AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)
 * 3. Azure CLI (local dev - az login)
 * 
 * @throws Error if Key Vault URL not configured
 */
export async function initializeSecrets(): Promise<void> {
  const keyVaultUrl = process.env.KEY_VAULT_URL;
  
  if (!keyVaultUrl) {
    // In local dev without Key Vault, use environment variables as fallback
    if (isLocalDevelopment()) {
      console.warn('⚠️ KEY_VAULT_URL not set - using environment variables (local dev only)');
      return;
    }
    
    throw new Error('KEY_VAULT_URL environment variable is required in production');
  }
  
  try {
    // DefaultAzureCredential tries multiple authentication methods automatically
    const credential = new DefaultAzureCredential();
    keyVaultClient = new SecretClient(keyVaultUrl, credential);
    
    console.log(`✅ Key Vault client initialized: ${keyVaultUrl}`);
    
    // Test connection by fetching a secret
    await keyVaultClient.getSecret(SECRET_NAMES.GEMINI_API_KEY);
    console.log('✅ Key Vault connection verified');
  } catch (error: any) {
    console.error('❌ Failed to initialize Key Vault:', error.message);
    
    // In local dev, fallback to env vars
    if (isLocalDevelopment()) {
      console.warn('⚠️ Falling back to environment variables (local dev only)');
      keyVaultClient = null;
      return;
    }
    
    throw error;
  }
}

/**
 * Get secret from Key Vault (with caching)
 * 
 * @param secretName - Name of the secret in Key Vault
 * @returns Secret value
 * @throws Error if secret not found or Key Vault not initialized
 */
export async function getSecret(secretName: string): Promise<string> {
  // Check cache first
  const cached = secretCache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  
  let secretValue: string;
  
  if (keyVaultClient) {
    // Fetch from Key Vault
    try {
      const secret = await keyVaultClient.getSecret(secretName);
      
      if (!secret.value) {
        throw new Error(`Secret ${secretName} has no value`);
      }
      
      secretValue = secret.value;
    } catch (error: any) {
      console.error(`❌ Failed to fetch secret ${secretName}:`, error.message);
      
      // Fallback to environment variable in local dev
      if (isLocalDevelopment()) {
        secretValue = getSecretFromEnv(secretName);
      } else {
        throw error;
      }
    }
  } else {
    // Key Vault not initialized - use environment variables (local dev only)
    if (!isLocalDevelopment()) {
      throw new Error('Key Vault not initialized and not in local development mode');
    }
    
    secretValue = getSecretFromEnv(secretName);
  }
  
  // Cache the secret
  secretCache.set(secretName, {
    value: secretValue,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
  
  return secretValue;
}

/**
 * Get secret from environment variable (fallback for local dev)
 */
function getSecretFromEnv(secretName: string): string {
  // Map Key Vault secret names to environment variable names
  const envVarMap: Record<string, string> = {
    [SECRET_NAMES.GEMINI_API_KEY]: 'GEMINI_API_KEY',
    [SECRET_NAMES.COSMOS_CONNECTION_STRING]: 'COSMOS_CONNECTION_STRING',
    [SECRET_NAMES.STORAGE_CONNECTION_STRING]: 'STORAGE_CONNECTION_STRING',
    [SECRET_NAMES.ENTRA_CLIENT_SECRET]: 'ENTRA_CLIENT_SECRET',
    [SECRET_NAMES.ENTRA_CLIENT_ID]: 'ENTRA_CLIENT_ID',
    [SECRET_NAMES.APPLICATION_INSIGHTS_KEY]: 'APPINSIGHTS_INSTRUMENTATIONKEY'
  };
  
  const envVarName = envVarMap[secretName];
  if (!envVarName) {
    throw new Error(`Unknown secret name: ${secretName}`);
  }
  
  const value = process.env[envVarName];
  if (!value) {
    throw new Error(`Secret ${secretName} not found in environment variables (${envVarName})`);
  }
  
  return value;
}

/**
 * Clear secret cache (useful for testing or secret rotation)
 */
export function clearSecretCache(): void {
  secretCache.clear();
  console.log('✅ Secret cache cleared');
}

/**
 * Get all required secrets and validate they exist
 * 
 * Call this at startup to fail fast if any required secrets are missing
 */
export async function validateRequiredSecrets(): Promise<void> {
  const requiredSecrets = [
    SECRET_NAMES.GEMINI_API_KEY,
    SECRET_NAMES.COSMOS_CONNECTION_STRING,
    SECRET_NAMES.STORAGE_CONNECTION_STRING
  ];
  
  const missingSecrets: string[] = [];
  
  for (const secretName of requiredSecrets) {
    try {
      await getSecret(secretName);
    } catch (error) {
      missingSecrets.push(secretName);
    }
  }
  
  if (missingSecrets.length > 0) {
    throw new Error(`Missing required secrets: ${missingSecrets.join(', ')}`);
  }
  
  console.log('✅ All required secrets validated');
}

/**
 * Secret rotation helper
 * 
 * Azure Key Vault supports automatic secret versioning. When you rotate a secret:
 * 1. Upload new version to Key Vault (via Azure Portal or CLI)
 * 2. The client automatically fetches the latest version
 * 3. Old versions remain accessible for rollback (optional)
 * 
 * No code changes needed - just clear the cache to force refetch:
 * ```typescript
 * clearSecretCache();
 * const newApiKey = await getSecret('gemini-api-key');
 * ```
 */
export async function rotateSecret(secretName: string): Promise<void> {
  // Remove from cache to force refetch
  secretCache.delete(secretName);
  
  // Fetch latest version
  const newValue = await getSecret(secretName);
  
  console.log(`✅ Secret ${secretName} rotated (new value length: ${newValue.length})`);
}

/**
 * Detect secrets in code (for git-secrets integration)
 * 
 * Patterns that should never appear in code:
 * - API keys (length 32-128 chars, alphanumeric)
 * - Connection strings (contains 'AccountKey=' or 'Password=')
 * - Private keys (PEM format)
 * - JWTs (3 base64 parts separated by dots)
 */
export const SECRET_PATTERNS = [
  // Gemini API key pattern
  /AIza[0-9A-Za-z-_]{35}/g,
  
  // Azure connection string pattern
  /AccountKey=[A-Za-z0-9+/=]{88}/g,
  /AccountEndpoint=https:\/\/[a-z0-9-]+\.documents\.azure\.com:443\/;AccountKey=/g,
  
  // Generic API key pattern (32-128 chars)
  /['"][a-zA-Z0-9]{32,128}['"]/g,
  
  // JWT pattern
  /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
  
  // Private key pattern
  /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----/g,
  
  // Password in connection string
  /Password=[^;]{8,}/gi,
  
  // Bearer token
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g
] as const;

/**
 * Scan text for potential secrets
 * 
 * @param text - Text to scan (e.g., code file content)
 * @returns Array of potential secret matches
 */
export function detectSecrets(text: string): Array<{ pattern: string; match: string; line: number }> {
  const findings: Array<{ pattern: string; match: string; line: number }> = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const pattern of SECRET_PATTERNS) {
      const matches = line.matchAll(pattern);
      
      for (const match of matches) {
        // Skip if it's a comment or example
        if (line.includes('//') || line.includes('/*') || line.includes('example') || line.includes('placeholder')) {
          continue;
        }
        
        findings.push({
          pattern: pattern.source,
          match: match[0],
          line: i + 1
        });
      }
    }
  }
  
  return findings;
}

/**
 * Environment-specific secret requirements
 */
export const SECRET_REQUIREMENTS = {
  development: [
    SECRET_NAMES.GEMINI_API_KEY,
    SECRET_NAMES.COSMOS_CONNECTION_STRING,
    SECRET_NAMES.STORAGE_CONNECTION_STRING
  ],
  production: [
    SECRET_NAMES.GEMINI_API_KEY,
    SECRET_NAMES.COSMOS_CONNECTION_STRING,
    SECRET_NAMES.STORAGE_CONNECTION_STRING,
    SECRET_NAMES.ENTRA_CLIENT_SECRET,
    SECRET_NAMES.ENTRA_CLIENT_ID,
    SECRET_NAMES.APPLICATION_INSIGHTS_KEY
  ]
} as const;

/**
 * Secret access audit logging
 * 
 * Log all secret accesses to Application Insights for security monitoring
 */
export function logSecretAccess(secretName: string, success: boolean, context?: any): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    secretName,
    success,
    source: context?.invocationId || 'unknown',
    environment: process.env.NODE_ENV || 'development'
  };
  
  // In production, this would go to Application Insights
  if (!success) {
    console.error('⚠️ Secret access failed:', logEntry);
  }
}
