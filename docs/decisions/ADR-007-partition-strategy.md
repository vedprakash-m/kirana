# ADR-007: Cosmos DB Partition Strategy

**Status:** Accepted  
**Date:** 2025-11-03  
**Deciders:** Engineering Team  
**Tags:** cosmos-db, partitioning, performance, scalability

## Context

Azure Cosmos DB requires a **partition key** to distribute data across physical partitions for scalability. The partition key choice affects:
- **Query performance**: Queries within a single partition are fast (<10ms)
- **Storage distribution**: Data evenly distributed avoids hot partitions
- **Transaction scope**: Multi-document transactions only within single partition
- **Cost**: Cross-partition queries consume more RUs (request units)

Kirana data model:
- **Items**: ~100-500 per household, frequently queried together
- **Transactions**: ~10-50 per item, used for prediction calculations
- **Users**: 1 per household (small collection)
- **Budgets**: 1 per household per day (time-series data)

We evaluated three partition key strategies:
1. **`/householdId`**: All household data co-located (items, transactions)
2. **`/itemId`**: Each item in separate partition
3. **`/category`**: Group by grocery category (DAIRY, PRODUCE, etc.)

## Decision

We will use **`/householdId`** as the partition key for all containers.

### Container Partition Keys

| Container | Partition Key | Rationale |
|-----------|--------------|-----------|
| `items` | `/householdId` | Dashboard loads all items for household (single-partition query) |
| `transactions` | `/householdId` | Prediction engine needs all transactions for household items |
| `users` | `/householdId` | Single user per household (co-located with items) |
| `budgets` | `/householdId` | Daily budget tracking per household |

### Query Patterns Optimized

**1. Dashboard Load (most frequent)**
```sql
-- Single-partition query (fast, low RU cost)
SELECT * FROM items i
WHERE i.householdId = 'user123'
  AND i.urgency IN ('critical', 'warning')
ORDER BY i.predictedRunOutDate ASC
```
- **Cost**: ~2-3 RUs (single partition read)
- **Latency**: <10ms

**2. Prediction Calculation**
```sql
-- Single-partition query (all transactions for household items)
SELECT * FROM transactions t
WHERE t.householdId = 'user123'
  AND t.itemId = 'item-uuid'
ORDER BY t.restockedAt DESC
```
- **Cost**: ~3-5 RUs (single partition + filter)
- **Latency**: <15ms

**3. Item Update (restock)**
```sql
-- Point read (partition key + id)
SELECT * FROM items i
WHERE i.householdId = 'user123'
  AND i.id = 'item-uuid'
```
- **Cost**: 1 RU (point read)
- **Latency**: <5ms

### Data Distribution

**Current Scale (MVP: 100 households)**:
- 100 partitions (1 per household)
- ~200-500 items per partition = 10-25 KB per partition
- **Total storage**: 1-2.5 MB (well below 20 GB partition limit)

**Growth Scale (1,000 households)**:
- 1,000 partitions
- Still ~200-500 items per partition
- **Total storage**: 10-25 MB (no hot partitions)

**Max Scale (100,000 households)**:
- 100,000 partitions
- Still ~200-500 items per partition
- **Total storage**: 1-2.5 GB (evenly distributed)

### Partition Size Calculation

```
Items per household: 200 (average)
Item document size: ~2 KB (including predictions)
Transactions per item: 10 (average)
Transaction document size: ~0.5 KB

Total per household = (200 items × 2 KB) + (200 × 10 × 0.5 KB)
                    = 400 KB + 1,000 KB
                    = 1.4 MB per partition

Cosmos DB partition limit: 20 GB
Household capacity per partition: 20,000 MB / 1.4 MB = ~14,000 households
```
✅ **Safe margin**: Current design supports 14,000 households per logical partition (we only have 1 household per partition)

## Consequences

### Positive

✅ **Fast dashboard queries**: All items for household in single partition (no fan-out)  
✅ **Efficient prediction calculations**: All transactions co-located with items  
✅ **Low RU consumption**: Dashboard load ~2-3 RUs (vs 10-20 RUs cross-partition)  
✅ **Simple client code**: No need to specify partition key in queries (implicit from householdId)  
✅ **Even distribution**: Each household = 1 partition (no hot partitions)  
✅ **Transaction support**: Can update multiple items for same household atomically  
✅ **Cost effective**: Single-partition queries 5× cheaper than cross-partition  

### Negative

❌ **Cross-household queries expensive**: Admin queries across all households are slow (rare use case)  
❌ **Household size limit**: Single household can't exceed 20 GB (14,000+ items unlikely)  
❌ **No shared items**: Can't have items shared across households (not a requirement)  
❌ **Partition key immutable**: Can't change householdId after creation (must delete/recreate)  

### Alternatives Considered

**`/itemId` (item-level partitioning)**:
- ❌ Rejected: Dashboard query fans out to 200 partitions (slow, expensive)
- ❌ Prediction calculation fans out to 10-50 partitions per item (10× RU cost)
- ✅ Better for multi-household shared items (not a use case)
- ❌ Higher latency (50-100ms vs <10ms)

**`/category` (category-level partitioning)**:
- ❌ Rejected: Uneven distribution (DAIRY has 50 items, SNACKS has 10)
- ❌ Dashboard query fans out to 9 partitions (one per category)
- ❌ Hot partitions for popular categories (PRODUCE, DAIRY)
- ✅ Good for category-specific reports (not a common query)

**Synthetic key `/householdId-category`**:
- ❌ Rejected: Over-partitioning (100 households × 9 categories = 900 partitions)
- ❌ Dashboard query still fans out to 9 partitions
- ❌ Adds complexity with no performance benefit

## Implementation Notes

### Creating Containers

```typescript
// Cosmos DB SDK (create items container)
const { container } = await database.containers.createIfNotExists({
  id: 'items',
  partitionKey: {
    paths: ['/householdId'],
    kind: 'Hash'
  },
  indexingPolicy: {
    automatic: true,
    indexingMode: 'consistent',
    includedPaths: [
      { path: '/*' }  // Index all properties (default)
    ],
    compositeIndexes: [
      [
        { path: '/householdId', order: 'ascending' },
        { path: '/urgency', order: 'ascending' },
        { path: '/predictedRunOutDate', order: 'ascending' }
      ]
    ]
  }
});
```

### Query Patterns (Client Code)

```typescript
// CosmosService.ts
export class CosmosService {
  async getItems(householdId: string, filter: string): Promise<Item[]> {
    const querySpec = {
      query: `
        SELECT * FROM items i
        WHERE i.householdId = @householdId
          AND (
            @filter = 'all'
            OR (@filter = 'running_out' AND i.daysUntilRunOut <= 7)
            OR (@filter = 'low_confidence' AND i.predictionConfidence = 'low')
          )
        ORDER BY i.urgency DESC, i.predictedRunOutDate ASC
      `,
      parameters: [
        { name: '@householdId', value: householdId },
        { name: '@filter', value: filter }
      ]
    };
    
    // Cosmos SDK automatically uses partition key from query
    const { resources } = await this.container.items
      .query(querySpec, { partitionKey: householdId })
      .fetchAll();
    
    return resources;
  }
  
  async getItemById(householdId: string, itemId: string): Promise<Item> {
    // Point read (1 RU)
    const { resource } = await this.container.item(itemId, householdId).read();
    return resource;
  }
  
  async createItem(item: Item): Promise<Item> {
    const { resource } = await this.container.items.create(item);
    return resource;
  }
}
```

### Monitoring Partition Health

```typescript
// Azure Portal > Cosmos DB > Metrics
// Monitor these metrics:
// - Normalized RU Consumption by PartitionKeyRangeId (detect hot partitions)
// - Storage by PartitionKeyRangeId (detect large partitions)
// - Throttled Requests (429 errors)

// App Insights query (detect slow cross-partition queries)
dependencies
| where name contains "cosmos"
| where duration > 100  // >100ms
| summarize count() by name, resultCode
```

## Partition Key Change Strategy (Future)

If `/householdId` becomes insufficient:
1. **Phase 1**: Add synthetic key `/householdId-shardId` (split large households)
2. **Phase 2**: Use hierarchical partition keys (Cosmos DB feature) `/householdId` + `/category`
3. **Phase 3**: Migrate to separate containers (premium households → dedicated container)

**Migration Tool** (if needed):
```typescript
// Migrate data to new partition key
async function migratePartitionKey() {
  const oldContainer = client.database('kirana').container('items-old');
  const newContainer = client.database('kirana').container('items-new');
  
  const { resources: items } = await oldContainer.items.readAll().fetchAll();
  
  for (const item of items) {
    // Add new partition key field
    item.householdIdV2 = item.householdId;
    await newContainer.items.create(item);
  }
}
```

## References

- [Cosmos DB Partitioning Best Practices](https://learn.microsoft.com/en-us/azure/cosmos-db/partitioning-overview)
- [Choosing a Partition Key](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/how-to-model-partition-example)
- [Query Performance Tuning](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/performance-tips-query-sdk)
- [Hierarchical Partition Keys](https://learn.microsoft.com/en-us/azure/cosmos-db/hierarchical-partition-keys)
- PRD Section 6: "Data Model"
- Tech Spec Section 2.1.2: "Partition Strategy"

## Review History

- 2025-11-03: Initial version (Accepted)
