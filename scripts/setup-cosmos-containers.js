/**
 * Cosmos DB Container Setup Script
 * 
 * This script creates all required Cosmos DB containers with proper
 * partition keys, throughput, and TTL settings.
 * 
 * Run with: node scripts/setup-cosmos-containers.js
 */

require('dotenv').config({ path: './backend/local.settings.json' });
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE_ID || 'kirana-dev';

if (!endpoint || !key) {
  console.error('❌ Missing COSMOS_ENDPOINT or COSMOS_KEY in environment variables');
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });

// Container configurations
const containers = [
  {
    id: 'items',
    partitionKey: '/householdId',
    throughput: 400, // Shared throughput
    ttl: false,
    indexingPolicy: {
      automatic: true,
      indexingMode: 'consistent',
      includedPaths: [{ path: '/*' }],
      excludedPaths: [
        { path: '/priceHistory/*/date/?' },
        { path: '/userOverrides/*/date/?' }
      ],
      compositeIndexes: [
        [
          { path: '/householdId', order: 'ascending' },
          { path: '/predictedRunOutDate', order: 'ascending' }
        ]
      ]
    }
  },
  {
    id: 'transactions',
    partitionKey: '/householdId',
    throughput: null, // Share with items
    ttl: false,
    indexingPolicy: {
      automatic: true,
      indexingMode: 'consistent',
      includedPaths: [{ path: '/*' }],
      excludedPaths: [{ path: '/sourceMetadata/*' }],
      compositeIndexes: [
        [
          { path: '/householdId', order: 'ascending' },
          { path: '/itemId', order: 'ascending' },
          { path: '/purchaseDate', order: 'descending' }
        ]
      ]
    }
  },
  {
    id: 'households',
    partitionKey: '/id',
    throughput: null,
    ttl: false
  },
  {
    id: 'cache',
    partitionKey: '/householdId',
    throughput: null,
    ttl: 7776000, // 90 days
    indexingPolicy: {
      automatic: true,
      indexingMode: 'consistent',
      compositeIndexes: [
        [
          { path: '/rawText', order: 'ascending' },
          { path: '/hitCount', order: 'descending' }
        ]
      ]
    }
  },
  {
    id: 'parseJobs',
    partitionKey: '/householdId',
    throughput: null,
    ttl: 604800, // 7 days
    indexingPolicy: {
      automatic: true,
      indexingMode: 'consistent',
      compositeIndexes: [
        [
          { path: '/householdId', order: 'ascending' },
          { path: '/createdAt', order: 'descending' }
        ]
      ]
    }
  },
  {
    id: 'events',
    partitionKey: '/householdId',
    throughput: null,
    ttl: 7776000, // 90 days
    indexingPolicy: {
      automatic: true,
      indexingMode: 'consistent',
      compositeIndexes: [
        [
          { path: '/householdId', order: 'ascending' },
          { path: '/eventType', order: 'ascending' },
          { path: '/timestamp', order: 'descending' }
        ]
      ]
    }
  },
  {
    id: 'costTracking',
    partitionKey: '/householdId',
    throughput: null,
    ttl: false,
    indexingPolicy: {
      automatic: true,
      indexingMode: 'consistent',
      compositeIndexes: [
        [
          { path: '/householdId', order: 'ascending' },
          { path: '/period', order: 'descending' }
        ]
      ]
    }
  }
];

async function createContainers() {
  console.log('🚀 Starting Cosmos DB container setup...\n');
  
  const database = client.database(databaseId);
  
  // Check if database exists
  try {
    await database.read();
    console.log(`✅ Database '${databaseId}' exists\n`);
  } catch (error) {
    console.error(`❌ Database '${databaseId}' not found. Please create it first.`);
    process.exit(1);
  }
  
  for (const containerConfig of containers) {
    try {
      console.log(`📦 Creating container: ${containerConfig.id}...`);
      
      const containerDef = {
        id: containerConfig.id,
        partitionKey: {
          paths: [containerConfig.partitionKey],
          kind: 'Hash'
        }
      };
      
      // Add TTL if specified
      if (containerConfig.ttl) {
        containerDef.defaultTtl = containerConfig.ttl;
      }
      
      // Add indexing policy if specified
      if (containerConfig.indexingPolicy) {
        containerDef.indexingPolicy = containerConfig.indexingPolicy;
      }
      
      const options = {};
      if (containerConfig.throughput) {
        options.offerThroughput = containerConfig.throughput;
      }
      
      const { container } = await database.containers.createIfNotExists(
        containerDef,
        options
      );
      
      console.log(`   ✅ Container '${containerConfig.id}' created successfully`);
      console.log(`   📊 Partition key: ${containerConfig.partitionKey}`);
      if (containerConfig.throughput) {
        console.log(`   ⚡ Throughput: ${containerConfig.throughput} RU/s (shared)`);
      } else {
        console.log(`   ⚡ Throughput: Shared from items container`);
      }
      if (containerConfig.ttl) {
        console.log(`   ⏰ TTL: ${containerConfig.ttl} seconds (${Math.floor(containerConfig.ttl / 86400)} days)`);
      }
      console.log();
      
    } catch (error) {
      if (error.code === 409) {
        console.log(`   ⚠️  Container '${containerConfig.id}' already exists`);
        console.log();
      } else {
        console.error(`   ❌ Error creating container '${containerConfig.id}':`, error.message);
        console.log();
      }
    }
  }
  
  console.log('================================================');
  console.log('✅ Cosmos DB container setup complete!');
  console.log('================================================\n');
  console.log('Created containers:');
  containers.forEach(c => console.log(`  • ${c.id}`));
  console.log();
}

// Run the setup
createContainers()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
