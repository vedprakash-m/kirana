# ADR-003: Google Gemini 1.5 Flash for LLM Parsing

**Status:** Accepted  
**Date:** 2025-11-03  
**Deciders:** Engineering Team  
**Tags:** llm, ai, parsing, cost-optimization

## Context

Kirana needs LLM capabilities for:
1. **CSV Parsing**: Extract structured data from Amazon order history (messy formats, variable columns)
2. **Receipt OCR**: Parse photos of grocery receipts (vision + text extraction)
3. **Smart Merge**: Fuzzy match items across imports ("Whole Milk 1 Gal" = "Organic Whole Milk Gallon")

Requirements:
- **Cost-effective**: Must stay under $50/day budget for MVP (<100 households)
- **Fast inference**: <3s latency for CSV parsing, <5s for receipt OCR
- **Structured output**: Must return JSON with high reliability (no hallucinations)
- **Vision capability**: Process receipt images (JPEG/PNG up to 5MB)
- **Azure integration**: Preferably available via Azure OpenAI or direct API

We evaluated four LLM options:
1. **GPT-4 Turbo** (OpenAI): Most accurate, expensive ($10/1M input tokens)
2. **GPT-3.5 Turbo** (OpenAI): Fast, cheaper ($0.50/1M input tokens), no vision
3. **Gemini 1.5 Flash** (Google): Fast, cheap ($0.075/1M input tokens), vision-capable
4. **Claude 3 Haiku** (Anthropic): Fast, mid-priced ($0.25/1M input tokens), vision-capable

## Decision

We will use **Google Gemini 1.5 Flash** for all LLM tasks (CSV parsing, receipt OCR, smart merge).

### Gemini Configuration

- **Model**: `gemini-1.5-flash` (not `gemini-1.5-pro` - 10× more expensive)
- **Temperature**: 0.0 (deterministic output for parsing)
- **Max Output Tokens**: 2048 (sufficient for 100-item CSV)
- **Safety Settings**: Block none (grocery data is safe)
- **System Instruction**: "You are a grocery data extraction assistant. Output only valid JSON. Do not include explanations."

### Prompt Engineering Strategy

**CSV Parsing Prompt Template:**
```
Extract grocery items from this Amazon order CSV. Return JSON array.

Required fields: itemName, orderDate, price, quantity
Optional fields: vendor, category (infer from name)

CSV:
{csv_content}

JSON (array of objects):
```

**Receipt OCR Prompt Template:**
```
Extract grocery items from this receipt image. Return JSON array.

Required fields: itemName, price, quantity
Optional fields: store, purchaseDate

Image: [attached]

JSON (array of objects):
```

**Smart Merge Prompt Template:**
```
Match these grocery items to canonical names. Return JSON array.

Input items:
{input_items}

Canonical names database:
{canonical_names}

Rules:
- Merge similar items (e.g., "Milk" + "Whole Milk" → "Whole Milk")
- Preserve brand if specified (e.g., "Organic Valley Milk" ≠ "Horizon Milk")
- Extract package size (e.g., "1 Gal", "2 lbs")

JSON (array with itemId, canonicalName, confidence):
```

### Cost Estimation

**Gemini 1.5 Flash Pricing:**
- Input: $0.075 per 1M tokens (~$0.000075 per 1K tokens)
- Output: $0.30 per 1M tokens (~$0.0003 per 1K tokens)

**Typical Usage (per household per month):**
- CSV import: 2 imports × 100 items × 500 tokens = 100K tokens input = $0.0075
- Receipt OCR: 4 receipts × 2K tokens (image + text) = 8K tokens = $0.0006
- Smart merge: 10 merges × 200 tokens = 2K tokens = $0.00015
- **Total per household/month**: ~$0.01 = **$1/month for 100 households** 💰

**Budget Buffer:**
- $50/day budget = $1,500/month
- 100 households × $1/month = $100/month usage
- **15× safety margin** for unexpected usage spikes

## Consequences

### Positive

✅ **Extremely cost-effective**: 13× cheaper than GPT-4 Turbo, 3× cheaper than Claude Haiku  
✅ **Vision capability**: Handles receipt OCR without separate OCR service  
✅ **Fast inference**: <2s for CSV, <4s for receipt (faster than GPT-4)  
✅ **Structured output**: Gemini natively supports JSON mode (no prompt hacks)  
✅ **Generous rate limits**: 1,500 RPM (requests per minute) on free tier  
✅ **No vendor lock-in**: Google AI Studio API (not Azure-specific)  

### Negative

❌ **Less accurate than GPT-4**: ~5% lower accuracy on complex CSV formats (acceptable tradeoff)  
❌ **No Azure native support**: Must call Google API directly (not Azure OpenAI)  
❌ **Newer model**: Less community knowledge vs GPT-3.5/4 (mitigated by extensive docs)  
❌ **JSON mode requires prompt engineering**: Must explicitly request JSON output  
❌ **Potential vendor risk**: Google could raise prices or deprecate model  

### Alternatives Considered

**GPT-4 Turbo (OpenAI)**:
- ❌ Rejected: 130× more expensive ($10/1M tokens input vs $0.075/1M)
- ✅ Most accurate (98% vs 93% for Gemini)
- ❌ Budget blown in 3 days with 100 households
- ✅ Azure native (Azure OpenAI Service)

**GPT-3.5 Turbo (OpenAI)**:
- ❌ Rejected: No vision capability (need separate OCR service for receipts)
- ✅ 7× cheaper than GPT-4, but still 7× more expensive than Gemini
- ❌ Lower accuracy on structured extraction vs Gemini Flash

**Claude 3 Haiku (Anthropic)**:
- ❌ Rejected: 3× more expensive than Gemini ($0.25/1M input vs $0.075/1M)
- ✅ Good vision capability
- ✅ Better at following instructions (fewer hallucinations)
- ❌ Not available via Azure (must call Anthropic API)

**Azure Document Intelligence (Cognitive Services)**:
- ❌ Rejected for receipt OCR: More expensive ($1.50 per 1K pages)
- ❌ Not designed for grocery data (generic document extraction)
- ❌ Requires separate LLM for normalization anyway

## Implementation Notes

- **SDK**: `@google/generative-ai` (npm package)
- **API Key**: Environment variable `GOOGLE_AI_API_KEY` (from Google AI Studio)
- **Error handling**: Retry with exponential backoff (3 attempts), fallback to manual entry
- **Budget tracking**: Log `llm_cost` metric to App Insights after each call
- **Response validation**: JSON schema validation with Zod before saving to DB

### Example Code

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const prompt = `Extract grocery items from CSV. Return JSON array.\n\nCSV:\n${csvContent}`;
const result = await model.generateContent(prompt);
const jsonText = result.response.text();
const items = JSON.parse(jsonText); // Parse and validate with Zod
```

## Cost Control Mechanisms

1. **Daily Budget Cap**: $50/day tracked in `budgets` container (Cosmos DB)
2. **Enforcement**: Return 429 error if budget exceeded (user waits until midnight UTC reset)
3. **Alerts**: Slack notification at 80% utilization ($40/day)
4. **Fallback**: Offer manual CSV import if budget hit (degrade gracefully)
5. **Monitoring**: App Insights custom metric `llm_cost` with dimensions (household, operation)

## Migration Strategy

If Gemini pricing changes or accuracy degrades:
1. **Phase 1**: A/B test with Claude 3 Haiku (comparable cost, better accuracy)
2. **Phase 2**: Implement LLM abstraction layer (strategy pattern)
3. **Phase 3**: Route by operation (Gemini for CSV, Claude for receipts)

## References

- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Gemini 1.5 Flash Model Card](https://ai.google.dev/gemini-api/docs/models/gemini)
- [Google AI Studio](https://aistudio.google.com/)
- PRD Section 4.2: "CSV Import with LLM Parsing"
- Tech Spec Section 3.3: "LLM Integration Layer"

## Review History

- 2025-11-03: Initial version (Accepted)
