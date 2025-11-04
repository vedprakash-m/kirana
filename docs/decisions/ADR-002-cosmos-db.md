# ADR-002: Azure Cosmos DB for NoSQL Storage

**Status:** Accepted  
**Date:** 2025-11-03  
**Deciders:** Engineering Team  
**Tags:** database, nosql, azure, storage

## Context

Kirana requires a database that can:
- Store grocery items with flexible schema (items vary by category, vendor, packaging)
- Handle high-frequency writes during CSV imports (100+ items in single batch)
- Support complex queries (filter by urgency, sort by predicted run-out date, pagination)
- Scale globally if app expands beyond single household
- Integrate seamlessly with Azure ecosystem (Functions, App Insights)
- Provide low latency for real-time predictions (<100ms read/write)

We evaluated three options:
1. **Azure Cosmos DB (NoSQL)**: Multi-model globally distributed database
2. **Azure SQL Database**: Relational SQL database
3. **Azure Table Storage**: Simple key-value NoSQL storage

## Decision

We will use **Azure Cosmos DB** with the **SQL API** (NoSQL document database).

### Configuration

- **Partition Key**: `/householdId` (all items for a household co-located)
- **Consistency Level**: Session (default, balances latency and consistency)
- **RU/s**: 400 (serverless autoscale for low-traffic MVP)
- **Containers**:
  - `items` (grocery items with predictions)
  - `transactions` (restock history for prediction engine)
  - `users` (household accounts and preferences)
  - `budgets` (daily LLM spend tracking)

### Schema Design

**Items Container:**
```json
{
  "id": "uuid",
  "householdId": "user123",
  "canonicalName": "Whole Milk",
  "category": "DAIRY",
  "predictedRunOutDate": "2025-11-15T00:00:00Z",
  "predictionConfidence": "high",
  "urgency": "warning",
  "daysUntilRunOut": 5,
  "lastRestocked": "2025-11-01T10:30:00Z",
  "averageConsumptionRate": 0.5,
  "predictionMetadata": {
    "algorithm": "exponential_smoothing",
    "alpha": 0.3,
    "factors": [
      {"factor": "min_transactions", "met": true, "value": 5},
      {"factor": "consistent_intervals", "met": true, "value": 0.15}
    ]
  }
}
```

**Transactions Container:**
```json
{
  "id": "uuid",
  "householdId": "user123",
  "itemId": "item-uuid",
  "restockedAt": "2025-11-01T10:30:00Z",
  "quantity": 1,
  "price": 4.99,
  "source": "amazon_csv"
}
```

### Indexing Strategy

- **Automatic indexing** on all properties (Cosmos DB default)
- **Composite indexes** for common queries:
  - `householdId + urgency + predictedRunOutDate` (dashboard view)
  - `householdId + category` (filter by category)
  - `householdId + predictionConfidence` (low-confidence items)

## Consequences

### Positive

✅ **Flexible schema**: Can add new item properties without migrations (e.g., `allergens`, `sustainabilityScore`)  
✅ **Fast writes**: Single-digit millisecond latency for writes (critical for CSV imports)  
✅ **Global distribution**: Can replicate to multiple regions if app scales internationally  
✅ **Automatic indexing**: No manual index management for ad-hoc queries  
✅ **Azure integration**: Native support in Azure Functions bindings (input/output)  
✅ **Change feed**: Can trigger Functions on data changes (real-time prediction updates)  
✅ **JSON native**: No ORM impedance mismatch (items stored as JSON documents)  

### Negative

❌ **Cost**: More expensive than Table Storage (~$0.008/10K RUs vs $0.045/GB)  
❌ **RU management**: Need to monitor and tune RU consumption (can spike with large imports)  
❌ **No ACID transactions across partitions**: Can't atomically update items from different households (acceptable for MVP single-household scope)  
❌ **Learning curve**: NoSQL query syntax different from SQL (SELECT * FROM c WHERE c.urgency = 'critical')  

### Alternatives Considered

**Azure SQL Database**:
- ❌ Rejected: Rigid schema requires migrations for new properties
- ❌ Slower for high-volume writes (need connection pooling, retries)
- ✅ Better for complex joins (but Kirana doesn't need joins)
- ❌ More expensive for low-traffic MVP ($5/month minimum vs pay-per-use)

**Azure Table Storage**:
- ❌ Rejected: Limited query capabilities (only PartitionKey and RowKey indexed by default)
- ❌ No sorting by multiple fields (can't sort by urgency + predicted date)
- ❌ No complex filters (would need client-side filtering = expensive)
- ✅ Cheaper ($0.045/GB storage)
- ❌ No change feed for real-time triggers

**MongoDB Atlas**:
- ❌ Rejected: Requires separate service outside Azure ecosystem
- ❌ More complex ops (self-managed or third-party)
- ✅ Mature NoSQL features (aggregation pipelines)
- ❌ Higher latency from Azure Functions (cross-cloud network)

## Implementation Notes

- **SDK**: `@azure/cosmos` (npm package)
- **Connection**: Environment variable `COSMOS_DB_CONNECTION_STRING`
- **Retry policy**: Exponential backoff with max 3 retries (handled by SDK)
- **Partition strategy**: 1 partition per household (optimizes queries within household)
- **TTL**: Set 90-day TTL on transactions (older data archived to Blob Storage)

### Example Query (Cosmos DB SQL API)

```sql
SELECT * FROM c
WHERE c.householdId = @householdId
  AND c.urgency IN ('critical', 'warning')
ORDER BY c.predictedRunOutDate ASC
OFFSET 0 LIMIT 20
```

## Migration Strategy

If Cosmos DB becomes too expensive at scale:
1. **Phase 1**: Move transactions to Table Storage (append-only, simple queries)
2. **Phase 2**: Keep items in Cosmos DB (complex queries needed)
3. **Phase 3**: Consider sharding by household tier (free users → Table Storage, premium → Cosmos DB)

## References

- [Azure Cosmos DB Documentation](https://learn.microsoft.com/en-us/azure/cosmos-db/)
- [Partitioning in Cosmos DB](https://learn.microsoft.com/en-us/azure/cosmos-db/partitioning-overview)
- [Cosmos DB Pricing](https://azure.microsoft.com/en-us/pricing/details/cosmos-db/)
- PRD Section 6: "Data Model"
- Tech Spec Section 2.1: "Database Architecture"

## Review History

- 2025-11-03: Initial version (Accepted)
