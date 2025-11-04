# Security Audit & Hardening Guide

**Project:** Kirana - Smart Grocery Inventory Tracker  
**Phase:** Pre-Production Security Review  
**Target:** OWASP Top 10 Compliance + Azure Best Practices  
**Date Created:** November 3, 2025

---

## 1. Overview

### Purpose
Comprehensive security audit to identify and remediate vulnerabilities before production launch. Ensure compliance with industry standards (OWASP Top 10) and Azure security best practices.

### Scope
- **Frontend:** React SPA (static web app)
- **Backend:** Azure Functions (Node.js)
- **Database:** Cosmos DB
- **Storage:** Azure Blob Storage
- **Authentication:** Azure AD B2C (JWT tokens)
- **External APIs:** Google Gemini API

### Security Goals
- ✅ No high or critical vulnerabilities
- ✅ OWASP Top 10 2021 compliance
- ✅ Azure Secure Score ≥80/100
- ✅ Data encryption at rest and in transit
- ✅ Principle of least privilege (RBAC)
- ✅ Secrets management via Azure Key Vault

---

## 2. OWASP Top 10 2021 Checklist

### A01:2021 – Broken Access Control

**Risk:** Users can access data/functions they shouldn't (e.g., view other users' items).

**Mitigation:**

1. **User ID Validation (Backend)**
   ```typescript
   // backend/functions/items.ts
   import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

   async function getItems(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
     // Extract user ID from JWT token
     const userId = req.headers.get('x-user-id'); // Set by Azure AD B2C middleware
     
     if (!userId) {
       return { status: 401, jsonBody: { error: 'Unauthorized' } };
     }

     // ALWAYS filter by user ID - never trust client input
     const items = await cosmosService.getItems({ userId });
     
     return { status: 200, jsonBody: items };
   }

   // ❌ NEVER DO THIS (trusts client-provided userId)
   // const userId = req.query.get('userId');
   ```

2. **Cosmos DB Partition Key Enforcement**
   ```typescript
   // backend/services/CosmosService.ts
   export class CosmosService {
     async getItem(itemId: string, userId: string): Promise<Item | null> {
       try {
         // Use userId as partition key to enforce isolation
         const { resource } = await this.container.item(itemId, userId).read();
         return resource || null;
       } catch (error: any) {
         if (error.code === 404) return null;
         throw error;
       }
     }

     async createItem(item: Item, userId: string): Promise<Item> {
       // Ensure item.userId matches the authenticated user
       if (item.userId !== userId) {
         throw new Error('User ID mismatch - potential access control violation');
       }

       const { resource } = await this.container.items.create({
         ...item,
         userId, // Force partition key to match authenticated user
       });
       return resource;
     }
   }
   ```

3. **JWT Token Validation Middleware**
   ```typescript
   // backend/middleware/auth.ts
   import jwt from 'jsonwebtoken';
   import jwksClient from 'jwks-rsa';

   const client = jwksClient({
     jwksUri: 'https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys',
   });

   export async function validateJWT(req: HttpRequest): Promise<string | null> {
     const authHeader = req.headers.get('authorization');
     if (!authHeader?.startsWith('Bearer ')) {
       return null;
     }

     const token = authHeader.substring(7);

     try {
       // Verify signature and expiration
       const decoded = jwt.verify(token, getKey, {
         audience: process.env.AZURE_AD_CLIENT_ID,
         issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
       }) as { sub: string };

       return decoded.sub; // User ID (subject claim)
     } catch (error) {
       console.error('JWT validation failed:', error);
       return null;
     }
   }

   function getKey(header: any, callback: any) {
     client.getSigningKey(header.kid, (err, key) => {
       if (err) return callback(err);
       const signingKey = key?.getPublicKey();
       callback(null, signingKey);
     });
   }
   ```

**Testing:**
- [ ] Try accessing `/api/items` without Authorization header → 401
- [ ] Try accessing another user's item by changing `itemId` → 404 or 403
- [ ] Verify Cosmos DB queries include `userId` partition key

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### A02:2021 – Cryptographic Failures

**Risk:** Sensitive data exposed due to weak encryption or unencrypted transmission.

**Mitigation:**

1. **HTTPS Enforcement**
   ```typescript
   // backend/host.json
   {
     "version": "2.0",
     "extensions": {
       "http": {
         "customHeaders": {
           "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
         }
       }
     }
   }
   ```

2. **Secrets in Azure Key Vault (Not Environment Variables)**
   ```bash
   # Azure CLI - Store secrets in Key Vault
   az keyvault secret set \
     --vault-name kirana-keyvault \
     --name cosmos-connection-string \
     --value "AccountEndpoint=https://..."

   az keyvault secret set \
     --vault-name kirana-keyvault \
     --name gemini-api-key \
     --value "AIza..."

   # Grant Functions App access to Key Vault
   az functionapp identity assign --name kirana-functions --resource-group kirana-rg
   PRINCIPAL_ID=$(az functionapp identity show --name kirana-functions --resource-group kirana-rg --query principalId -o tsv)

   az keyvault set-policy \
     --name kirana-keyvault \
     --object-id $PRINCIPAL_ID \
     --secret-permissions get list
   ```

3. **Application Settings (Key Vault References)**
   ```json
   // Azure Functions App Settings
   {
     "COSMOS_CONNECTION_STRING": "@Microsoft.KeyVault(SecretUri=https://kirana-keyvault.vault.azure.net/secrets/cosmos-connection-string/)",
     "GEMINI_API_KEY": "@Microsoft.KeyVault(SecretUri=https://kirana-keyvault.vault.azure.net/secrets/gemini-api-key/)",
     "ENABLE_HTTPS_ONLY": "true"
   }
   ```

4. **Cosmos DB Encryption at Rest**
   - ✅ Enabled by default (Microsoft-managed keys)
   - For customer-managed keys (CMK):
     ```bash
     az cosmosdb update \
       --name kirana-cosmosdb \
       --resource-group kirana-rg \
       --key-uri https://kirana-keyvault.vault.azure.net/keys/cosmos-key/
     ```

5. **No Sensitive Data in Logs**
   ```typescript
   // ❌ BAD - Logs full item object (may contain PII)
   console.log('Creating item:', item);

   // ✅ GOOD - Logs only non-sensitive fields
   console.log('Creating item:', { itemId: item.id, name: item.canonicalName });
   ```

**Testing:**
- [ ] Verify all HTTP requests redirect to HTTPS
- [ ] Check Key Vault access policies (Functions App has `get` permission only)
- [ ] Scan logs for leaked secrets (API keys, connection strings)
- [ ] Confirm Cosmos DB encryption at rest enabled

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### A03:2021 – Injection

**Risk:** SQL injection, NoSQL injection, command injection via unsanitized input.

**Mitigation:**

1. **Parameterized Cosmos DB Queries**
   ```typescript
   // ✅ SAFE - Uses parameterized query
   const query = {
     query: 'SELECT * FROM c WHERE c.userId = @userId AND c.name = @name',
     parameters: [
       { name: '@userId', value: userId },
       { name: '@name', value: itemName },
     ],
   };
   const { resources } = await container.items.query(query).fetchAll();

   // ❌ UNSAFE - String concatenation (NoSQL injection risk)
   const query = `SELECT * FROM c WHERE c.userId = '${userId}' AND c.name = '${itemName}'`;
   ```

2. **Input Validation (Zod Schemas)**
   ```typescript
   // backend/schemas/item.ts
   import { z } from 'zod';

   export const CreateItemSchema = z.object({
     name: z.string().min(1).max(100).trim(),
     quantity: z.number().int().positive().max(1000),
     packageSize: z.string().max(50).optional(),
     category: z.enum(['PRODUCE', 'DAIRY', 'MEAT', 'PANTRY', 'FROZEN', 'BEVERAGES', 'SNACKS', 'OTHER']),
     purchaseDate: z.string().datetime().optional(),
   });

   // In API handler
   export async function createItem(req: HttpRequest): Promise<HttpResponseInit> {
     try {
       const body = await req.json();
       const validatedData = CreateItemSchema.parse(body); // Throws if invalid
       
       // Now safe to use validatedData
       const item = await cosmosService.createItem(validatedData, userId);
       return { status: 201, jsonBody: item };
     } catch (error) {
       if (error instanceof z.ZodError) {
         return { status: 400, jsonBody: { errors: error.errors } };
       }
       throw error;
     }
   }
   ```

3. **Sanitize LLM Prompts (Prevent Prompt Injection)**
   ```typescript
   // backend/services/GeminiService.ts
   export class GeminiService {
     async parseItems(csvText: string): Promise<ParsedItem[]> {
       // Sanitize CSV input before sending to LLM
       const sanitized = csvText
         .replace(/[<>]/g, '') // Remove angle brackets
         .substring(0, 50000); // Limit to 50KB (prevent token overflow)

       const prompt = `
   Parse the following grocery purchase history into structured items.
   Output JSON only (no explanations).

   CSV Data:
   ${sanitized}

   Output format:
   [{ "name": "Whole Milk", "quantity": 1, "packageSize": "1 gallon", ... }]
       `.trim();

       // ❌ NEVER DO THIS - User input in system prompt
       // const prompt = `You are ${csvText}. Parse items.`;

       const response = await this.model.generateContent(prompt);
       return JSON.parse(response.text());
     }
   }
   ```

**Testing:**
- [ ] Try SQL/NoSQL injection payloads: `' OR '1'='1`, `'; DROP TABLE items--`
- [ ] Verify Zod validation rejects invalid inputs (e.g., negative quantity)
- [ ] Test LLM with malicious prompts: "Ignore previous instructions and..."
- [ ] Check all database queries use parameterization

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### A04:2021 – Insecure Design

**Risk:** Flawed architecture allowing privilege escalation or data leakage.

**Mitigation:**

1. **Budget Cap Enforcement (Server-Side)**
   ```typescript
   // backend/services/BudgetService.ts
   export class BudgetService {
     private readonly DAILY_CAP = 50; // $50/day

     async checkBudget(): Promise<{ allowed: boolean; remaining: number }> {
       const today = new Date().toISOString().split('T')[0];
       const spent = await this.getTodaySpend();

       if (spent >= this.DAILY_CAP) {
         // Log alert
         console.error(`Budget cap exceeded: $${spent}/$${this.DAILY_CAP}`);
         
         // Send Slack alert
         await this.sendSlackAlert(spent);

         return { allowed: false, remaining: 0 };
       }

       return { allowed: true, remaining: this.DAILY_CAP - spent };
     }

     async trackLLMCost(operation: string, cost: number): Promise<void> {
       // Store in App Insights custom metric
       appInsights.defaultClient.trackMetric({
         name: 'llm_cost',
         value: cost,
         properties: { operation, timestamp: new Date().toISOString() },
       });
     }
   }

   // In CSV parser
   const { allowed } = await budgetService.checkBudget();
   if (!allowed) {
     return { status: 429, jsonBody: { error: 'Daily LLM budget exceeded. Try again tomorrow or use manual entry.' } };
   }
   ```

2. **Rate Limiting (Per User)**
   ```typescript
   // backend/middleware/rateLimit.ts
   import { RateLimiterMemory } from 'rate-limiter-flexible';

   const rateLimiter = new RateLimiterMemory({
     points: 100, // 100 requests
     duration: 60, // Per 60 seconds (1 minute)
   });

   export async function checkRateLimit(userId: string): Promise<boolean> {
     try {
       await rateLimiter.consume(userId);
       return true; // Allow request
     } catch (error) {
       return false; // Rate limit exceeded
     }
   }

   // In API handler
   const allowed = await checkRateLimit(userId);
   if (!allowed) {
     return { status: 429, jsonBody: { error: 'Rate limit exceeded. Try again in 1 minute.' } };
   }
   ```

3. **Teach Mode Validation (Prevent Abuse)**
   ```typescript
   // Limit teach mode submissions per user per day
   const MAX_TEACH_SUBMISSIONS_PER_DAY = 50;

   export async function recordTeachMode(userId: string): Promise<boolean> {
     const today = new Date().toISOString().split('T')[0];
     const key = `teach_mode:${userId}:${today}`;
     
     const count = await redis.incr(key);
     if (count === 1) {
       await redis.expire(key, 86400); // 24 hours
     }

     if (count > MAX_TEACH_SUBMISSIONS_PER_DAY) {
       console.warn(`User ${userId} exceeded teach mode limit: ${count} submissions`);
       return false;
     }

     return true;
   }
   ```

**Testing:**
- [ ] Try bypassing budget cap via direct API calls → 429 error
- [ ] Send 101 requests in 1 minute → Rate limit triggered
- [ ] Submit 51 teach mode entries in 1 day → Limit enforced
- [ ] Verify all limits logged in App Insights

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### A05:2021 – Security Misconfiguration

**Risk:** Default configs, exposed debug endpoints, verbose error messages.

**Mitigation:**

1. **Content Security Policy (CSP) Headers**
   ```typescript
   // frontend/vite.config.ts
   import { defineConfig } from 'vite';

   export default defineConfig({
     plugins: [
       {
         name: 'html-transform',
         transformIndexHtml(html) {
           return html.replace(
             '<head>',
             `<head>
               <meta http-equiv="Content-Security-Policy" content="
                 default-src 'self';
                 script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
                 style-src 'self' 'unsafe-inline';
                 img-src 'self' data: https:;
                 connect-src 'self' https://kirana-api.azurewebsites.net https://generativelanguage.googleapis.com;
                 font-src 'self' data:;
               ">
             `
           );
         },
       },
     ],
   });
   ```

2. **CORS Configuration (Restrict Origins)**
   ```typescript
   // backend/host.json
   {
     "version": "2.0",
     "extensions": {
       "http": {
         "customHeaders": {
           "Access-Control-Allow-Origin": "https://app.kirana.io",
           "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
           "Access-Control-Allow-Headers": "Content-Type, Authorization",
           "Access-Control-Max-Age": "86400"
         }
       }
     }
   }
   ```

3. **Disable Debug Mode in Production**
   ```json
   // backend/local.settings.json (development only)
   {
     "IsEncrypted": false,
     "Values": {
       "NODE_ENV": "development",
       "DEBUG": "true"
     }
   }

   // Production App Settings (Azure Portal)
   {
     "NODE_ENV": "production",
     "DEBUG": "false",
     "FUNCTIONS_WORKER_RUNTIME": "node"
   }
   ```

4. **Generic Error Messages (No Stack Traces in Production)**
   ```typescript
   // backend/middleware/errorHandler.ts
   export function handleError(error: Error, context: InvocationContext): HttpResponseInit {
     // Log full error server-side
     context.error('API Error:', error);

     // Return generic message to client (don't leak internals)
     if (process.env.NODE_ENV === 'production') {
       return {
         status: 500,
         jsonBody: { error: 'An unexpected error occurred. Please try again.' },
       };
     }

     // In development, return detailed error for debugging
     return {
       status: 500,
       jsonBody: {
         error: error.message,
         stack: error.stack,
       },
     };
   }
   ```

5. **Remove Default Accounts/Keys**
   ```bash
   # Azure Cosmos DB Emulator (Development Only)
   # ❌ NEVER use this connection string in production
   CONNECTION_STRING="AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5..."

   # ✅ Production uses Key Vault reference
   COSMOS_CONNECTION_STRING="@Microsoft.KeyVault(...)"
   ```

**Testing:**
- [ ] Verify CSP headers block inline scripts (browser console)
- [ ] Try CORS from unauthorized origin → Blocked
- [ ] Trigger error and verify no stack trace returned (prod mode)
- [ ] Check Azure Functions logs for sensitive data exposure

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### A06:2021 – Vulnerable and Outdated Components

**Risk:** Using libraries with known CVEs (Common Vulnerabilities and Exposures).

**Mitigation:**

1. **Automated Dependency Scanning**
   ```yaml
   # .github/workflows/security-scan.yml
   name: Security Scan

   on:
     push:
       branches: [main, develop]
     pull_request:
       branches: [main, develop]
     schedule:
       - cron: '0 6 * * 1' # Weekly on Mondays at 6 AM UTC

   jobs:
     dependency-check:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4

         - name: Run npm audit (Backend)
           working-directory: ./backend
           run: |
             npm audit --audit-level=moderate
             npm audit fix --dry-run

         - name: Run npm audit (Frontend)
           working-directory: ./frontend
           run: |
             npm audit --audit-level=moderate
             npm audit fix --dry-run

         - name: Snyk Security Scan
           uses: snyk/actions/node@master
           env:
             SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
           with:
             args: --severity-threshold=high --fail-on=all
   ```

2. **Dependabot Configuration**
   ```yaml
   # .github/dependabot.yml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/backend"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 5
       ignore:
         - dependency-name: "*"
           update-types: ["version-update:semver-major"]

     - package-ecosystem: "npm"
       directory: "/frontend"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 5
   ```

3. **Pin Major Versions (package.json)**
   ```json
   // backend/package.json
   {
     "dependencies": {
       "@azure/functions": "^4.0.0", // Allow minor/patch updates
       "@azure/cosmos": "^4.0.0",
       "zod": "^3.22.0",
       "rate-limiter-flexible": "^5.0.0"
     }
   }
   ```

4. **Monthly Dependency Review**
   ```bash
   # Check for outdated packages
   cd backend && npm outdated
   cd frontend && npm outdated

   # Review CVEs
   npm audit

   # Update non-breaking changes
   npm update

   # Test after updates
   npm test
   npm run build
   ```

**Testing:**
- [ ] Run `npm audit` and verify 0 high/critical vulnerabilities
- [ ] Check Dependabot PRs and merge security updates
- [ ] Verify Snyk scan passes in CI

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### A07:2021 – Identification and Authentication Failures

**Risk:** Weak authentication, session hijacking, credential stuffing.

**Mitigation:**

1. **Azure AD B2C Integration** (Already implemented)
   ```typescript
   // frontend/src/services/authService.ts
   import { PublicClientApplication } from '@azure/msal-browser';

   const msalConfig = {
     auth: {
       clientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID,
       authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_AD_TENANT_ID}`,
       redirectUri: window.location.origin,
     },
     cache: {
       cacheLocation: 'localStorage',
       storeAuthStateInCookie: false,
     },
   };

   export const msalInstance = new PublicClientApplication(msalConfig);
   ```

2. **JWT Token Expiration** (Short-Lived Tokens)
   ```typescript
   // Access token: 1 hour expiration
   // Refresh token: 14 days expiration (sliding window)

   const tokenRequest = {
     scopes: ['User.Read', 'api://kirana-api/.default'],
     forceRefresh: false, // Use cached token if valid
   };

   const response = await msalInstance.acquireTokenSilent(tokenRequest);
   if (isTokenExpired(response.accessToken)) {
     await msalInstance.acquireTokenRedirect(tokenRequest);
   }
   ```

3. **Secure Session Storage**
   ```typescript
   // ✅ GOOD - Use httpOnly cookies for refresh tokens (if using custom auth)
   // Azure AD B2C handles this automatically

   // ❌ BAD - Storing tokens in localStorage (XSS risk)
   // localStorage.setItem('token', accessToken);
   ```

4. **Password Policy** (Azure AD B2C)
   - Minimum 8 characters
   - Require uppercase, lowercase, number, special character
   - Account lockout after 5 failed attempts
   - MFA option (optional, recommended for admins)

**Testing:**
- [ ] Verify JWT expires after 1 hour → Requires re-authentication
- [ ] Try using expired token → 401 Unauthorized
- [ ] Test account lockout after 5 failed logins
- [ ] Check token not exposed in URL or logs

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### A08:2021 – Software and Data Integrity Failures

**Risk:** Unsigned code, untrusted CI/CD pipelines, insecure deserialization.

**Mitigation:**

1. **Subresource Integrity (SRI) for CDN Scripts**
   ```html
   <!-- frontend/index.html -->
   <script
     src="https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js"
     integrity="sha384-KyZXEAg3QhqLMpG8r+Knujsl5+z8..."
     crossorigin="anonymous"
   ></script>
   ```

2. **Signed NPM Packages** (Verify Package Integrity)
   ```bash
   # Generate package-lock.json with integrity hashes
   npm install --package-lock-only

   # Verify integrity during CI
   npm ci # Strict install from package-lock.json
   ```

3. **Azure Functions Deployment Slots** (Blue-Green Deployment)
   ```bash
   # Deploy to staging slot first
   az functionapp deployment slot create \
     --name kirana-functions \
     --resource-group kirana-rg \
     --slot staging

   # Run smoke tests on staging
   curl https://kirana-functions-staging.azurewebsites.net/api/health

   # Swap staging to production (zero downtime)
   az functionapp deployment slot swap \
     --name kirana-functions \
     --resource-group kirana-rg \
     --slot staging \
     --target-slot production
   ```

4. **Input Deserialization Safety**
   ```typescript
   // ❌ UNSAFE - Direct JSON parsing (prototype pollution risk)
   const item = JSON.parse(req.body);

   // ✅ SAFE - Validate with Zod schema first
   const item = CreateItemSchema.parse(JSON.parse(req.body));
   ```

**Testing:**
- [ ] Verify SRI hashes for all CDN scripts
- [ ] Check `package-lock.json` committed to Git
- [ ] Test deployment slot swap (staging → production)
- [ ] Try prototype pollution attack: `{"__proto__": {"isAdmin": true}}`

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### A09:2021 – Security Logging and Monitoring Failures

**Risk:** Attacks go undetected due to insufficient logging/alerting.

**Mitigation:**

1. **Application Insights Logging** (Already implemented)
   ```typescript
   // backend/services/AppInsightsService.ts
   import * as appInsights from 'applicationinsights';

   appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
     .setAutoCollectRequests(true)
     .setAutoCollectPerformance(true)
     .setAutoCollectExceptions(true)
     .setAutoCollectDependencies(true)
     .setAutoCollectConsole(true)
     .start();

   const client = appInsights.defaultClient;

   // Track security events
   export function logSecurityEvent(event: string, properties: Record<string, any>) {
     client.trackEvent({
       name: `Security:${event}`,
       properties: {
         ...properties,
         timestamp: new Date().toISOString(),
         severity: 'Warning',
       },
     });
   }

   // Example usage
   logSecurityEvent('BudgetCapExceeded', { userId, spent: 52.30 });
   logSecurityEvent('RateLimitExceeded', { userId, endpoint: '/api/items' });
   logSecurityEvent('UnauthorizedAccess', { userId, attemptedResource: itemId });
   ```

2. **Azure Monitor Alerts**
   ```bash
   # Alert on high error rate (>10 errors in 5 minutes)
   az monitor metrics alert create \
     --name "High Error Rate" \
     --resource-group kirana-rg \
     --scopes /subscriptions/{subscriptionId}/resourceGroups/kirana-rg/providers/Microsoft.Web/sites/kirana-functions \
     --condition "count exceptions/server > 10" \
     --window-size 5m \
     --evaluation-frequency 1m \
     --action email admin@kirana.io

   # Alert on budget cap (>$45 in 1 day)
   az monitor metrics alert create \
     --name "LLM Budget Warning" \
     --condition "sum customMetrics/llm_cost > 45" \
     --window-size 1d \
     --action email ops@kirana.io slack-webhook
   ```

3. **Log Retention Policy**
   ```bash
   # Set Application Insights retention to 90 days
   az monitor app-insights component update \
     --app kirana-app-insights \
     --resource-group kirana-rg \
     --retention-time 90
   ```

4. **Security Incident Response Runbook** (Link to existing)
   - See: `docs/runbooks/security-incident-response.md`
   - On-call rotation: PagerDuty integration
   - Escalation path: Dev → Senior Dev → CTO

**Testing:**
- [ ] Trigger test alert (simulate 11 errors in 5 min) → Email received
- [ ] Verify security events logged in App Insights
- [ ] Check log retention set to 90 days
- [ ] Test on-call escalation flow

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

### A10:2021 – Server-Side Request Forgery (SSRF)

**Risk:** Attacker tricks backend into making requests to internal services.

**Mitigation:**

1. **Whitelist External API Domains**
   ```typescript
   // backend/services/GeminiService.ts
   const ALLOWED_DOMAINS = [
     'generativelanguage.googleapis.com',
   ];

   export function validateURL(url: string): boolean {
     try {
       const parsed = new URL(url);
       return ALLOWED_DOMAINS.some(domain => parsed.hostname.endsWith(domain));
     } catch {
       return false;
     }
   }

   // Before making external request
   if (!validateURL(apiUrl)) {
     throw new Error('Invalid API URL');
   }
   ```

2. **Block Private IP Ranges**
   ```typescript
   import { isPrivateIP } from 'private-ip';

   export function isSafeURL(url: string): boolean {
     const parsed = new URL(url);
     
     // Block private IPs (localhost, 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
     if (isPrivateIP(parsed.hostname)) {
       return false;
     }

     // Block cloud metadata endpoints
     const blockedHosts = [
       '169.254.169.254', // AWS/Azure metadata
       'metadata.google.internal', // GCP metadata
     ];

     if (blockedHosts.some(host => parsed.hostname === host)) {
       return false;
     }

     return true;
   }
   ```

3. **No User-Controlled URLs**
   ```typescript
   // ❌ VULNERABLE - User controls webhook URL
   app.http('webhook', {
     methods: ['POST'],
     handler: async (req) => {
       const { webhookUrl } = await req.json();
       await fetch(webhookUrl, { method: 'POST', body: '...' }); // SSRF risk!
     },
   });

   // ✅ SAFE - Predefined webhook URL
   const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
   await fetch(WEBHOOK_URL, { method: 'POST', body: '...' });
   ```

**Testing:**
- [ ] Try SSRF payloads: `http://localhost:8080`, `http://169.254.169.254/metadata`
- [ ] Verify private IP ranges blocked
- [ ] Check all external requests use whitelisted domains

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

---

## 3. Azure Security Best Practices

### Azure Secure Score Target: ≥80/100

**Check Azure Security Center Dashboard:**
```bash
# View secure score
az security secure-score list --output table

# View recommendations
az security assessment list --output table
```

### 3.1 Network Security

**Cosmos DB Firewall**
```bash
# Allow only Azure Functions IP (or VNet)
az cosmosdb update \
  --name kirana-cosmosdb \
  --resource-group kirana-rg \
  --enable-public-network false \
  --enable-virtual-network true

# Or allow specific IPs
az cosmosdb update \
  --name kirana-cosmosdb \
  --resource-group kirana-rg \
  --ip-range-filter "40.76.54.131,40.121.158.30" # Functions App IPs
```

**Storage Account - Disable Public Access**
```bash
az storage account update \
  --name kiranastore \
  --resource-group kirana-rg \
  --allow-blob-public-access false \
  --public-network-access Disabled
```

### 3.2 Identity and Access Management (IAM)

**Principle of Least Privilege**
```bash
# Functions App - Read-only access to Cosmos DB
az cosmosdb sql role assignment create \
  --account-name kirana-cosmosdb \
  --resource-group kirana-rg \
  --role-definition-id 00000000-0000-0000-0000-000000000002 \ # Cosmos DB Data Contributor
  --principal-id $FUNCTIONS_PRINCIPAL_ID \
  --scope "/dbs/kirana-db/colls/items"

# CI/CD Pipeline - Deploy permissions only (no read data)
az role assignment create \
  --assignee $CICD_PRINCIPAL_ID \
  --role "Website Contributor" \
  --scope /subscriptions/{subscriptionId}/resourceGroups/kirana-rg/providers/Microsoft.Web/sites/kirana-functions
```

### 3.3 Key Vault Best Practices

**Key Vault Configuration**
```bash
# Enable soft delete (30-day recovery window)
az keyvault update \
  --name kirana-keyvault \
  --resource-group kirana-rg \
  --enable-soft-delete true \
  --retention-days 30

# Enable purge protection (prevent permanent deletion)
az keyvault update \
  --name kirana-keyvault \
  --enable-purge-protection true

# Set access policies (no broad "list all secrets")
az keyvault set-policy \
  --name kirana-keyvault \
  --object-id $FUNCTIONS_PRINCIPAL_ID \
  --secret-permissions get
```

### 3.4 Logging and Auditing

**Diagnostic Settings**
```bash
# Enable diagnostic logs for Cosmos DB
az monitor diagnostic-settings create \
  --name cosmos-logs \
  --resource /subscriptions/{subscriptionId}/resourceGroups/kirana-rg/providers/Microsoft.DocumentDB/databaseAccounts/kirana-cosmosdb \
  --logs '[{"category": "DataPlaneRequests", "enabled": true, "retentionPolicy": {"enabled": true, "days": 90}}]' \
  --workspace /subscriptions/{subscriptionId}/resourceGroups/kirana-rg/providers/Microsoft.OperationalInsights/workspaces/kirana-logs
```

---

## 4. OWASP ZAP Automated Scan

### Setup

1. **Install OWASP ZAP**
   ```bash
   # Docker image
   docker pull zaproxy/zap-stable

   # Or download from https://www.zaproxy.org/download/
   ```

2. **Run Baseline Scan**
   ```bash
   docker run -v $(pwd):/zap/wrk:rw -t zaproxy/zap-stable \
     zap-baseline.py \
     -t https://kirana-api-staging.azurewebsites.net \
     -r zap-report.html \
     -J zap-report.json
   ```

3. **Review Report**
   - Open `zap-report.html` in browser
   - Focus on **High** and **Medium** severity findings
   - Ignore false positives (e.g., missing CSP on Azure-generated pages)

### Expected Findings (To Fix)

| Finding | Severity | Fix |
|---------|----------|-----|
| Missing CSP header | Medium | Add to `host.json` custom headers |
| CORS misconfiguration | Medium | Restrict to frontend domain only |
| Verbose error messages | Low | Generic errors in production |
| Missing rate limiting | Medium | Implement per-user rate limiting |

### CI Integration (Optional)

```yaml
# .github/workflows/security-scan.yml
- name: OWASP ZAP Scan
  uses: zaproxy/action-baseline@v0.7.0
  with:
    target: 'https://kirana-api-staging.azurewebsites.net'
    rules_file_name: '.zap/rules.tsv'
    fail_action: true # Fail build if high-severity findings
```

---

## 5. Penetration Testing (Optional)

### Manual Tests

1. **Authentication Bypass**
   - Try accessing `/api/items` without token → 401
   - Try using expired token → 401
   - Try modifying JWT payload → Invalid signature error

2. **Authorization Bypass**
   - Try accessing another user's item: `GET /api/items/{otherUserId}/{itemId}` → 404

3. **Injection Attacks**
   - SQL injection: `itemName='OR'1'='1`
   - NoSQL injection: `{"$ne": null}`
   - Command injection: `name=test; rm -rf /`

4. **Rate Limiting**
   - Send 101 requests in 1 minute → 429 error

5. **Budget Cap**
   - Trigger 20 CSV imports in 1 day → Budget cap error

### External Pentest (Recommended)

**Provider:** Cobalt.io, Synack, or HackerOne  
**Cost:** $5,000-$10,000  
**Scope:** Backend API, frontend, authentication flow  
**Timeline:** 2-3 weeks

---

## 6. Security Checklist (Pre-Launch)

### Backend
- [ ] All API endpoints require JWT authentication
- [ ] User ID extracted from token (not query param)
- [ ] Cosmos DB queries use `userId` partition key
- [ ] All inputs validated with Zod schemas
- [ ] Parameterized queries (no string concatenation)
- [ ] Rate limiting: 100 req/min per user
- [ ] Budget cap: $50/day enforced
- [ ] Secrets in Azure Key Vault (not env vars)
- [ ] HTTPS enforced (HSTS header)
- [ ] Generic error messages in production

### Frontend
- [ ] CSP headers configured
- [ ] CORS restricted to frontend domain
- [ ] JWT tokens not logged or exposed in URL
- [ ] XSS protection (React escapes by default)
- [ ] Subresource Integrity (SRI) for CDN scripts

### Azure Infrastructure
- [ ] Cosmos DB firewall enabled (Azure Functions only)
- [ ] Storage account public access disabled
- [ ] Key Vault soft delete enabled (30 days)
- [ ] Application Insights logging enabled
- [ ] Diagnostic logs retained for 90 days
- [ ] Azure Secure Score ≥80/100

### CI/CD
- [ ] Dependabot enabled (weekly scans)
- [ ] `npm audit` runs on every PR
- [ ] Snyk security scan passes
- [ ] OWASP ZAP scan passes (or findings remediated)
- [ ] Deployment uses staging slot first

### Compliance
- [ ] OWASP Top 10 2021 compliance documented
- [ ] Security audit report reviewed by team
- [ ] Incident response runbook tested
- [ ] On-call rotation configured (PagerDuty)

---

## 7. Post-Launch Monitoring

### Weekly Security Review
- [ ] Check Azure Secure Score (any new recommendations?)
- [ ] Review Application Insights security events
- [ ] Check Dependabot PRs (merge security updates)
- [ ] Review failed login attempts (Azure AD B2C logs)

### Monthly Security Review
- [ ] Run OWASP ZAP scan on production
- [ ] Update dependencies (`npm audit`, `npm outdated`)
- [ ] Review Key Vault access logs
- [ ] Test incident response procedures

### Quarterly Security Review
- [ ] External penetration test (optional, $5k-$10k)
- [ ] Team security training (OWASP awareness)
- [ ] Review and update security policies

---

## Appendix: Security Tools

| Tool | Purpose | Cost |
|------|---------|------|
| OWASP ZAP | Automated vulnerability scanning | Free |
| Snyk | Dependency scanning + CVE alerts | Free tier (up to 200 tests/month) |
| Dependabot | Automated dependency updates | Free (GitHub native) |
| Azure Security Center | Cloud security posture management | Included with Azure |
| Application Insights | Logging + monitoring | ~$2/GB (free tier: 5GB/month) |

---

**Last Updated:** November 3, 2025  
**Owner:** Security + DevOps Team  
**Status:** Ready for Implementation
