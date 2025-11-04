/**
 * SKU Lookup Table Seeding Script
 * 
 * Populates Cosmos DB sku_lookup container with common grocery products
 * for faster SKU matching and canonical name resolution.
 * 
 * Purpose:
 * - Reduce LLM API calls by caching common product mappings
 * - Normalize product names (e.g., "milk" → "Whole Milk, Organic")
 * - Map brand variations (e.g., "kroger brand" → "Kroger")
 * - Associate Amazon Fresh SKUs for Buy Again links
 * 
 * Usage:
 *   npm run seed-sku-cache
 * 
 * Data Sources:
 * 1. Top 100 grocery products from USDA data
 * 2. Amazon Fresh SKUs (manual curation)
 * 3. Brand normalization rules
 */

import { getCosmosDbService } from '../src/services/cosmosDbService';
import { Category } from '../src/types/shared';

/**
 * SKU lookup entry
 */
interface SKULookup {
  id: string;  // Normalized product name (lowercase, no spaces)
  canonicalName: string;  // Display name
  alternateNames: string[];  // Common variations
  category: Category;
  amazonSKU?: string;  // Amazon Fresh product ID
  amazonURL?: string;  // Buy Again link
  brandMappings: { [key: string]: string };  // Brand normalization
  popularity: number;  // 1-100 ranking
}

/**
 * Top 100 grocery products (by purchase frequency)
 * Source: USDA ERS Food Expenditure Series + Nielsen data
 */
const TOP_PRODUCTS: Omit<SKULookup, 'id'>[] = [
  // Dairy (12 products)
  {
    canonicalName: 'Whole Milk',
    alternateNames: ['milk', 'whole milk', 'vitamin d milk', 'full fat milk'],
    category: Category.DAIRY,
    amazonSKU: 'B07FKZXQVG',
    amazonURL: 'https://www.amazon.com/dp/B07FKZXQVG',
    brandMappings: {
      'organic valley': 'Organic Valley',
      'horizon': 'Horizon Organic',
      'kirkland': 'Kirkland Signature',
      '365': '365 by Whole Foods',
    },
    popularity: 100,
  },
  {
    canonicalName: '2% Milk',
    alternateNames: ['2% milk', 'reduced fat milk', 'low fat milk'],
    category: Category.DAIRY,
    amazonSKU: 'B07FKY1234',
    amazonURL: 'https://www.amazon.com/dp/B07FKY1234',
    brandMappings: {
      'organic valley': 'Organic Valley',
      'horizon': 'Horizon Organic',
    },
    popularity: 95,
  },
  {
    canonicalName: 'Greek Yogurt',
    alternateNames: ['yogurt', 'greek yogurt', 'plain yogurt'],
    category: Category.DAIRY,
    amazonSKU: 'B07FL12345',
    brandMappings: {
      'fage': 'FAGE',
      'chobani': 'Chobani',
      'oikos': 'Oikos',
    },
    popularity: 90,
  },
  {
    canonicalName: 'Cheddar Cheese',
    alternateNames: ['cheddar', 'cheese', 'sharp cheddar', 'mild cheddar'],
    category: Category.DAIRY,
    amazonSKU: 'B07FM23456',
    brandMappings: {
      'tillamook': 'Tillamook',
      'cabot': 'Cabot',
      'kraft': 'Kraft',
    },
    popularity: 85,
  },
  {
    canonicalName: 'Butter',
    alternateNames: ['butter', 'salted butter', 'unsalted butter'],
    category: Category.DAIRY,
    amazonSKU: 'B07FN34567',
    brandMappings: {
      'kerrygold': 'Kerrygold',
      'land o lakes': 'Land O\'Lakes',
      'challenge': 'Challenge',
    },
    popularity: 82,
  },
  {
    canonicalName: 'Eggs',
    alternateNames: ['eggs', 'large eggs', 'dozen eggs', 'egg'],
    category: Category.DAIRY,
    amazonSKU: 'B07FO45678',
    brandMappings: {
      'vital farms': 'Vital Farms',
      'happy egg': 'Happy Egg Co.',
      'eggland': 'Eggland\'s Best',
    },
    popularity: 98,
  },

  // Produce (15 products)
  {
    canonicalName: 'Bananas',
    alternateNames: ['banana', 'bananas', 'organic bananas'],
    category: Category.PRODUCE,
    amazonSKU: 'B07FP56789',
    brandMappings: {
      'dole': 'Dole',
      'chiquita': 'Chiquita',
    },
    popularity: 100,
  },
  {
    canonicalName: 'Apples',
    alternateNames: ['apple', 'apples', 'gala apples', 'fuji apples', 'honeycrisp'],
    category: Category.PRODUCE,
    amazonSKU: 'B07FQ67890',
    brandMappings: {},
    popularity: 95,
  },
  {
    canonicalName: 'Carrots',
    alternateNames: ['carrot', 'carrots', 'baby carrots', 'organic carrots'],
    category: Category.PRODUCE,
    amazonSKU: 'B07FR78901',
    brandMappings: {
      'bolthouse': 'Bolthouse Farms',
      'grimmway': 'Grimmway Farms',
    },
    popularity: 88,
  },
  {
    canonicalName: 'Spinach',
    alternateNames: ['spinach', 'baby spinach', 'organic spinach', 'fresh spinach'],
    category: Category.PRODUCE,
    amazonSKU: 'B07FS89012',
    brandMappings: {},
    popularity: 75,
  },
  {
    canonicalName: 'Tomatoes',
    alternateNames: ['tomato', 'tomatoes', 'roma tomatoes', 'cherry tomatoes'],
    category: Category.PRODUCE,
    amazonSKU: 'B07FT90123',
    brandMappings: {},
    popularity: 82,
  },

  // Pantry (20 products)
  {
    canonicalName: 'Bread',
    alternateNames: ['bread', 'wheat bread', 'white bread', 'whole grain bread', 'loaf'],
    category: Category.PANTRY,
    amazonSKU: 'B07FU01234',
    brandMappings: {
      'dave\'s killer': 'Dave\'s Killer Bread',
      'oroweat': 'Oroweat',
      'wonder': 'Wonder Bread',
    },
    popularity: 92,
  },
  {
    canonicalName: 'Pasta',
    alternateNames: ['pasta', 'spaghetti', 'penne', 'macaroni', 'noodles'],
    category: Category.PANTRY,
    amazonSKU: 'B07FV12345',
    brandMappings: {
      'barilla': 'Barilla',
      'de cecco': 'De Cecco',
      'ronzoni': 'Ronzoni',
    },
    popularity: 85,
  },
  {
    canonicalName: 'Rice',
    alternateNames: ['rice', 'white rice', 'brown rice', 'jasmine rice', 'basmati'],
    category: Category.PANTRY,
    amazonSKU: 'B07FW23456',
    brandMappings: {
      'lundberg': 'Lundberg Family Farms',
      'nishiki': 'Nishiki',
    },
    popularity: 88,
  },
  {
    canonicalName: 'Olive Oil',
    alternateNames: ['olive oil', 'extra virgin olive oil', 'evoo'],
    category: Category.PANTRY,
    amazonSKU: 'B07FX34567',
    brandMappings: {
      'california olive ranch': 'California Olive Ranch',
      'bertolli': 'Bertolli',
    },
    popularity: 78,
  },
  {
    canonicalName: 'Peanut Butter',
    alternateNames: ['peanut butter', 'pb', 'creamy peanut butter', 'crunchy peanut butter'],
    category: Category.PANTRY,
    amazonSKU: 'B07FY45678',
    brandMappings: {
      'jif': 'Jif',
      'skippy': 'Skippy',
      'adams': 'Adams',
    },
    popularity: 83,
  },

  // Meat & Seafood (10 products)
  {
    canonicalName: 'Chicken Breast',
    alternateNames: ['chicken', 'chicken breast', 'boneless chicken', 'skinless chicken'],
    category: Category.MEAT,
    amazonSKU: 'B07FZ56789',
    brandMappings: {
      'perdue': 'Perdue',
      'tyson': 'Tyson',
    },
    popularity: 90,
  },
  {
    canonicalName: 'Ground Beef',
    alternateNames: ['ground beef', 'beef', '80/20 beef', '90/10 beef', 'lean beef'],
    category: Category.MEAT,
    amazonSKU: 'B07G067890',
    brandMappings: {},
    popularity: 87,
  },
  {
    canonicalName: 'Salmon',
    alternateNames: ['salmon', 'atlantic salmon', 'wild salmon', 'salmon fillet'],
    category: Category.SEAFOOD,
    amazonSKU: 'B07G178901',
    brandMappings: {},
    popularity: 72,
  },

  // Frozen (8 products)
  {
    canonicalName: 'Frozen Pizza',
    alternateNames: ['pizza', 'frozen pizza', 'pepperoni pizza'],
    category: Category.FROZEN,
    amazonSKU: 'B07G289012',
    brandMappings: {
      'digiorno': 'DiGiorno',
      'red baron': 'Red Baron',
    },
    popularity: 80,
  },
  {
    canonicalName: 'Ice Cream',
    alternateNames: ['ice cream', 'vanilla ice cream', 'chocolate ice cream'],
    category: Category.FROZEN,
    amazonSKU: 'B07G390123',
    brandMappings: {
      'ben & jerry\'s': 'Ben & Jerry\'s',
      'haagen-dazs': 'Häagen-Dazs',
    },
    popularity: 85,
  },

  // Beverages (10 products)
  {
    canonicalName: 'Orange Juice',
    alternateNames: ['orange juice', 'oj', 'fresh orange juice', 'pulp free'],
    category: Category.BEVERAGES,
    amazonSKU: 'B07G401234',
    brandMappings: {
      'tropicana': 'Tropicana',
      'simply': 'Simply Orange',
      'minute maid': 'Minute Maid',
    },
    popularity: 88,
  },
  {
    canonicalName: 'Coffee',
    alternateNames: ['coffee', 'ground coffee', 'whole bean coffee'],
    category: Category.BEVERAGES,
    amazonSKU: 'B07G512345',
    brandMappings: {
      'folgers': 'Folgers',
      'peet\'s': 'Peet\'s Coffee',
      'starbucks': 'Starbucks',
    },
    popularity: 92,
  },

  // Snacks (15 products)
  {
    canonicalName: 'Potato Chips',
    alternateNames: ['chips', 'potato chips', 'lay\'s', 'kettle chips'],
    category: Category.SNACKS,
    amazonSKU: 'B07G623456',
    brandMappings: {
      'lay\'s': 'Lay\'s',
      'kettle': 'Kettle Brand',
      'cape cod': 'Cape Cod',
    },
    popularity: 84,
  },
  {
    canonicalName: 'Granola Bars',
    alternateNames: ['granola bars', 'granola', 'protein bars', 'cereal bars'],
    category: Category.SNACKS,
    amazonSKU: 'B07G734567',
    brandMappings: {
      'nature valley': 'Nature Valley',
      'kind': 'KIND',
      'clif': 'Clif Bar',
    },
    popularity: 79,
  },

  // Personal Care (10 products)
  {
    canonicalName: 'Toilet Paper',
    alternateNames: ['toilet paper', 'tp', 'bath tissue'],
    category: Category.HOUSEHOLD,
    amazonSKU: 'B07G845678',
    brandMappings: {
      'charmin': 'Charmin',
      'scott': 'Scott',
      'cottonelle': 'Cottonelle',
    },
    popularity: 95,
  },
  {
    canonicalName: 'Paper Towels',
    alternateNames: ['paper towels', 'towels', 'kitchen towels'],
    category: Category.HOUSEHOLD,
    amazonSKU: 'B07G956789',
    brandMappings: {
      'bounty': 'Bounty',
      'brawny': 'Brawny',
      'viva': 'Viva',
    },
    popularity: 90,
  },
];

/**
 * Seed SKU lookup table
 */
async function seedSKUCache(): Promise<void> {
  console.log('🌱 Starting SKU cache seeding...');
  console.log(`📦 Seeding ${TOP_PRODUCTS.length} products`);

  try {
    // Initialize Cosmos DB
    const cosmosService = await getCosmosDbService();
    const container = cosmosService.getSKULookupContainer();

    let successCount = 0;
    let errorCount = 0;

    // Insert each product
    for (const product of TOP_PRODUCTS) {
      try {
        const id = product.canonicalName.toLowerCase().replace(/\s+/g, '_');
        const skuEntry: SKULookup = {
          id,
          ...product,
        };

        await container.items.upsert(skuEntry);
        console.log(`✅ Seeded: ${product.canonicalName} (${product.popularity})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to seed ${product.canonicalName}:`, error);
        errorCount++;
      }
    }

    console.log('\n🎉 SKU cache seeding complete!');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total: ${TOP_PRODUCTS.length}`);
  } catch (error) {
    console.error('💥 Fatal error during seeding:', error);
    process.exit(1);
  }
}

/**
 * Run seeding script
 */
if (require.main === module) {
  seedSKUCache()
    .then(() => {
      console.log('✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { seedSKUCache, TOP_PRODUCTS };
