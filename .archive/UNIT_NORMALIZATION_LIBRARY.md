# Unit Normalization Library - Reference Implementation

> **Reference:** Extracted from Tech_Spec_Kirana.md Section 3.2  
> **Date:** November 2, 2025

## Overview

TypeScript module for normalizing grocery item units with zero dependencies. Handles multi-pack formats, fractions, SKU lookups, and promotional edge cases.

## Implementation

```typescript
// src/shared/unitNormalizer.ts

export enum UnitType {
  WEIGHT = 'weight',
  VOLUME = 'volume',
  COUNT = 'count',
  UNKNOWN = 'unknown'
}

export enum StandardUnit {
  // Weight
  OZ = 'oz',
  LB = 'lb',
  G = 'g',
  KG = 'kg',
  // Volume
  FL_OZ = 'fl_oz',
  GAL = 'gal',
  QT = 'qt',
  PT = 'pt',
  ML = 'ml',
  L = 'l',
  // Count
  COUNT = 'count',
  PACK = 'pack',
  EACH = 'each'
}

interface NormalizedUnit {
  type: UnitType;
  standardUnit: StandardUnit;
  standardQuantity: number;
  originalUnit: string;
  originalQuantity: number;
}

const WEIGHT_CONVERSIONS: Record<string, number> = {
  'oz': 1,
  'lb': 16,
  'g': 0.035274,
  'kg': 35.274
};

const VOLUME_CONVERSIONS: Record<string, number> = {
  'fl_oz': 1,
  'fl oz': 1,
  'cup': 8,
  'pt': 16,
  'pint': 16,
  'qt': 32,
  'quart': 32,
  'gal': 128,
  'gallon': 128,
  'ml': 0.033814,
  'l': 33.814,
  'liter': 33.814
};

// SKU Lookup Table (top 5K most common grocery items)
// Loaded from Cosmos DB `cache` container at startup
interface SKUMapping {
  sku: string;
  canonicalName: string;
  brand: string;
  retailer: string;
  unitType: UnitType;
  standardUnit: StandardUnit;
  standardQuantity: number;
  confidence: number; // 1.0 for verified SKUs
}

export class UnitNormalizer {
  private static skuCache: Map<string, SKUMapping> = new Map();
  
  static async loadSKUCache(cosmosContainer: any): Promise<void> {
    // Load top 5K SKUs from Cosmos `cache` container
    const { resources } = await cosmosContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.type = @type ORDER BY c.frequency DESC OFFSET 0 LIMIT 5000',
        parameters: [{ name: '@type', value: 'sku_mapping' }]
      })
      .fetchAll();
    
    resources.forEach((sku: SKUMapping) => {
      this.skuCache.set(sku.sku, sku);
    });
  }
  
  /**
   * Normalize unit string with multi-strategy approach:
   * 1. SKU lookup (deterministic, high confidence)
   * 2. Regex parsing with heuristics
   * 3. Return null for manual review if ambiguous
   */
  static normalize(
    quantity: number, 
    unit: string,
    context?: { 
      retailer?: string;
      sku?: string;
      rawText?: string; 
    }
  ): (NormalizedUnit & { confidence: number }) | null {
    const cleanUnit = unit.toLowerCase().trim();
    
    // STRATEGY 1: SKU Lookup (highest confidence)
    if (context?.sku && this.skuCache.has(context.sku)) {
      const skuData = this.skuCache.get(context.sku)!;
      return {
        type: skuData.unitType,
        standardUnit: skuData.standardUnit,
        standardQuantity: quantity * skuData.standardQuantity,
        originalUnit: unit,
        originalQuantity: quantity,
        confidence: 1.0,
      };
    }
    
    // STRATEGY 2: Parse multi-pack format ("12 × 8 oz" → 96 oz total)
    const multiPackMatch = cleanUnit.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(\w+)/);
    if (multiPackMatch) {
      const packCount = parseInt(multiPackMatch[1]);
      const unitSize = parseFloat(multiPackMatch[2]);
      const unitName = multiPackMatch[3];
      
      const baseNormalized = this.normalize(unitSize, unitName);
      if (baseNormalized) {
        return {
          ...baseNormalized,
          standardQuantity: baseNormalized.standardQuantity * packCount * quantity,
          originalUnit: unit,
          confidence: 0.85, // High confidence for explicit multi-pack
        };
      }
    }
    
    // STRATEGY 3: Parse fractional units ("1/2 lb" → 0.5 lb)
    const fractionMatch = cleanUnit.match(/(\d+)\/(\d+)\s*(\w+)/);
    if (fractionMatch) {
      const numerator = parseInt(fractionMatch[1]);
      const denominator = parseInt(fractionMatch[2]);
      const unitName = fractionMatch[3];
      
      const fractionalQty = (numerator / denominator) * quantity;
      const baseNormalized = this.normalize(fractionalQty, unitName);
      if (baseNormalized) {
        return { ...baseNormalized, confidence: 0.85 };
      }
    }
    
    // STRATEGY 4: Standard unit conversions
    // Weight normalization
    if (cleanUnit in WEIGHT_CONVERSIONS) {
      return {
        type: UnitType.WEIGHT,
        standardUnit: StandardUnit.OZ,
        standardQuantity: quantity * WEIGHT_CONVERSIONS[cleanUnit],
        originalUnit: unit,
        originalQuantity: quantity,
        confidence: 0.9,
      };
    }
    
    // Volume normalization
    if (cleanUnit in VOLUME_CONVERSIONS) {
      return {
        type: UnitType.VOLUME,
        standardUnit: StandardUnit.FL_OZ,
        standardQuantity: quantity * VOLUME_CONVERSIONS[cleanUnit],
        originalUnit: unit,
        originalQuantity: quantity,
        confidence: 0.9,
      };
    }
    
    // Count normalization
    if (['count', 'each', 'pack', 'ct', 'ea'].includes(cleanUnit)) {
      return {
        type: UnitType.COUNT,
        standardUnit: StandardUnit.COUNT,
        standardQuantity: quantity,
        originalUnit: unit,
        originalQuantity: quantity,
        confidence: 0.8,
      };
    }
    
    // STRATEGY 5: Heuristic for promotional formats ("2 for $5")
    // Return null to trigger micro-review with suggested unit
    if (context?.rawText?.match(/\d+\s+for\s+\$\d+/i)) {
      console.warn('Promotional format detected, flagging for review:', context.rawText);
      return null; // Trigger micro-review
    }
    
    // Unknown unit - flag for manual review
    return null;
  }
  
  static calculateUnitPrice(
    totalPrice: number, 
    quantity: number, 
    unit: string,
    context?: { retailer?: string; sku?: string; rawText?: string }
  ): { unitPrice: number; confidence: number } | null {
    const normalized = this.normalize(quantity, unit, context);
    if (!normalized) return null;
    
    return {
      unitPrice: totalPrice / normalized.standardQuantity,
      confidence: normalized.confidence,
    };
  }
  
  static compareUnits(unit1: string, unit2: string): boolean {
    // Returns true if units are of same type (can be compared)
    const norm1 = this.normalize(1, unit1);
    const norm2 = this.normalize(1, unit2);
    
    if (!norm1 || !norm2) return false;
    return norm1.type === norm2.type;
  }
  
  /**
   * Tokenize and canonicalize item names for cache lookup
   * Strips brand tokens, pack descriptors, promotional text
   */
  static canonicalizeItemName(rawText: string): string {
    let cleaned = rawText.toLowerCase().trim();
    
    // Remove promotional text
    cleaned = cleaned.replace(/\b(sale|discount|bonus|free|save|extra)\b/gi, '');
    
    // Remove pack descriptors
    cleaned = cleaned.replace(/\(\d+\s*-?\s*pack\)/gi, '');
    cleaned = cleaned.replace(/\b\d+\s*ct\b/gi, '');
    
    // Remove size descriptors from name (keep in unit field)
    cleaned = cleaned.replace(/\b\d+(?:\.\d+)?\s*(oz|lb|gal|fl\s*oz|ml|l|g|kg)\b/gi, '');
    
    // Normalize common abbreviations
    cleaned = cleaned.replace(/\borg\b/g, 'organic');
    cleaned = cleaned.replace(/\bwhl\b/g, 'whole');
    cleaned = cleaned.replace(/\bmlk\b/g, 'milk');
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }
}
```

## Edge Cases Handled

- **SKU Match:** Top 5K SKUs → deterministic normalization (confidence: 1.0)
- **Multi-pack:** "12 × 8 oz" → 96 oz total (confidence: 0.85)
- **Fractions:** "1/2 lb" → 0.5 lb = 8 oz (confidence: 0.85)
- **Promotions:** "2 for $5" → return null → trigger micro-review
- **Family size** (no unit) → return null → flag for manual review
- **12 oz vs 12 fl oz** → distinguish via WEIGHT vs VOLUME conversions
- **Missing units** → return null → prompt in micro-review

## Confidence Scoring

- `1.0` = SKU match (deterministic, verified)
- `0.9` = Standard unit conversion (oz, lb, gal, etc.)
- `0.85` = Multi-pack or fraction parsing (heuristic)
- `0.8` = Count/Each normalization
- `null` = Ambiguous or promotional format → manual review

## Test Coverage Requirements

1,000 SKU test harness required before Phase 2 (target: >90% normalization success)
