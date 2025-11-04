/**
 * Unit Normalization Library
 * 
 * Converts various unit formats to canonical units for price comparison.
 * Implements a 5-step cascade for maximum accuracy:
 * 1. SKU lookup (conf=1.0)
 * 2. Multi-pack regex (conf=0.9)
 * 3. Fraction regex (conf=0.9)
 * 4. Heuristic conversion (conf=0.85)
 * 5. Failed (conf=0.0, flag for review)
 * 
 * Tech Spec Reference: Section 7.8 - Unit Normalization for Price Tracking
 * PRD Reference: Section 6 - Price Tracking (Phase 2 feature)
 */

import { UnitOfMeasure } from '../types/shared';

export interface NormalizationResult {
  success: boolean;
  canonicalUnit: 'oz' | 'fl_oz' | 'count' | null;
  quantity: number;
  confidence: number;
  method: 'sku' | 'multi-pack' | 'fraction' | 'heuristic' | 'failed';
  originalInput: string;
  warnings?: string[];
}

export interface SKUMapping {
  sku: string;
  retailer?: string;
  canonicalName: string;
  canonicalUnit: 'oz' | 'fl_oz' | 'count';
  quantity: number;
  frequency: number; // For cache eviction
}

/**
 * Conversion tables for weight and volume
 */
const WEIGHT_CONVERSIONS: Record<string, number> = {
  'oz': 1,
  'lb': 16,
  'pound': 16,
  'kg': 35.274,
  'g': 0.035274,
  'gram': 0.035274
};

const VOLUME_CONVERSIONS: Record<string, number> = {
  'fl_oz': 1,
  'floz': 1,
  'fluid_ounce': 1,
  'cup': 8,
  'pt': 16,
  'pint': 16,
  'qt': 32,
  'quart': 32,
  'gal': 128,
  'gallon': 128,
  'l': 33.814,
  'liter': 33.814,
  'ml': 0.033814,
  'milliliter': 0.033814
};

/**
 * Regex patterns for parsing
 */
const MULTI_PACK_REGEX = /(\d+)\s*[x×*]\s*(\d+\.?\d*)\s*(oz|fl\s?oz|lb|g|kg|ml|l)/i;
const FRACTION_REGEX = /(\d+)?\s*(\d+)\/(\d+)\s*(oz|fl\s?oz|lb|gal|qt|pt|cup|l|ml)/i;
const MIXED_NUMBER_REGEX = /(\d+)\s+(\d+)\/(\d+)\s*(oz|fl\s?oz|lb|gal|qt|pt|cup|l|ml)/i;
const DECIMAL_REGEX = /(\d+\.?\d*)\s*(oz|fl\s?oz|lb|gal|qt|pt|cup|l|ml|g|kg)/i;

/**
 * Main normalization function
 */
export function normalize(
  input: string,
  skuMapping?: SKUMapping
): NormalizationResult {
  const warnings: string[] = [];
  
  // Step 1: SKU lookup (highest confidence)
  if (skuMapping) {
    return {
      success: true,
      canonicalUnit: skuMapping.canonicalUnit,
      quantity: skuMapping.quantity,
      confidence: 1.0,
      method: 'sku',
      originalInput: input
    };
  }

  // Canonicalize input (lowercase, remove promotional text)
  const canonicalInput = canonicalizeInput(input);

  // Step 2: Multi-pack regex (e.g., "12x8oz", "6 pack 12 fl oz")
  const multiPackResult = parseMultiPack(canonicalInput);
  if (multiPackResult.success) {
    return { ...multiPackResult, originalInput: input };
  }

  // Step 3: Fraction regex (e.g., "1/2 lb", "2 1/4 gal")
  const fractionResult = parseFraction(canonicalInput);
  if (fractionResult.success) {
    return { ...fractionResult, originalInput: input };
  }

  // Step 4: Decimal/heuristic conversion
  const heuristicResult = parseHeuristic(canonicalInput);
  if (heuristicResult.success) {
    return { ...heuristicResult, originalInput: input };
  }

  // Step 5: Failed
  warnings.push('Could not parse unit. Manual review required.');
  return {
    success: false,
    canonicalUnit: null,
    quantity: 0,
    confidence: 0,
    method: 'failed',
    originalInput: input,
    warnings
  };
}

/**
 * Step 2: Parse multi-pack format (12×8oz → 96oz)
 */
export function parseMultiPack(input: string): NormalizationResult {
  const match = input.match(MULTI_PACK_REGEX);
  if (!match) {
    return { success: false, canonicalUnit: null, quantity: 0, confidence: 0, method: 'failed', originalInput: input };
  }

  const packCount = parseInt(match[1]);
  const unitSize = parseFloat(match[2]);
  const unit = match[3].toLowerCase().replace(/\s+/g, '_');

  const totalQuantity = packCount * unitSize;

  // Determine if weight or volume
  const canonicalUnit = isVolumeUnit(unit) ? 'fl_oz' : 'oz';
  const conversionFactor = canonicalUnit === 'fl_oz' 
    ? (VOLUME_CONVERSIONS[unit] || 1)
    : (WEIGHT_CONVERSIONS[unit] || 1);

  return {
    success: true,
    canonicalUnit,
    quantity: totalQuantity * conversionFactor,
    confidence: 0.9,
    method: 'multi-pack',
    originalInput: input
  };
}

/**
 * Step 3: Parse fractions (1/2 lb → 8oz, 2 1/4 gal → 288fl_oz)
 */
export function parseFraction(input: string): NormalizationResult {
  // Try mixed number first (e.g., "2 1/4 gal")
  let match = input.match(MIXED_NUMBER_REGEX);
  if (match) {
    const whole = parseInt(match[1]);
    const numerator = parseInt(match[2]);
    const denominator = parseInt(match[3]);
    const unit = match[4].toLowerCase().replace(/\s+/g, '_');

    const decimalValue = whole + (numerator / denominator);
    return convertToCanonical(decimalValue, unit, 0.9, 'fraction', input);
  }

  // Try simple fraction (e.g., "1/2 lb")
  match = input.match(FRACTION_REGEX);
  if (match) {
    const whole = match[1] ? parseInt(match[1]) : 0;
    const numerator = parseInt(match[2]);
    const denominator = parseInt(match[3]);
    const unit = match[4].toLowerCase().replace(/\s+/g, '_');

    const decimalValue = whole + (numerator / denominator);
    return convertToCanonical(decimalValue, unit, 0.9, 'fraction', input);
  }

  return { success: false, canonicalUnit: null, quantity: 0, confidence: 0, method: 'failed', originalInput: input };
}

/**
 * Step 4: Heuristic conversion (decimal units)
 */
export function parseHeuristic(input: string): NormalizationResult {
  const match = input.match(DECIMAL_REGEX);
  if (!match) {
    return { success: false, canonicalUnit: null, quantity: 0, confidence: 0, method: 'failed', originalInput: input };
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase().replace(/\s+/g, '_');

  return convertToCanonical(value, unit, 0.85, 'heuristic', input);
}

/**
 * Convert value and unit to canonical form
 */
function convertToCanonical(
  value: number,
  unit: string,
  confidence: number,
  method: 'sku' | 'multi-pack' | 'fraction' | 'heuristic' | 'failed',
  originalInput: string
): NormalizationResult {
  const isVolume = isVolumeUnit(unit);
  const canonicalUnit = isVolume ? 'fl_oz' : 'oz';

  const conversionTable = isVolume ? VOLUME_CONVERSIONS : WEIGHT_CONVERSIONS;
  const conversionFactor = conversionTable[unit] || 1;

  return {
    success: true,
    canonicalUnit,
    quantity: value * conversionFactor,
    confidence,
    method,
    originalInput
  };
}

/**
 * Determine if unit is volume (vs weight)
 */
function isVolumeUnit(unit: string): boolean {
  const volumeUnits = ['fl_oz', 'floz', 'fluid_ounce', 'cup', 'pt', 'pint', 'qt', 'quart', 'gal', 'gallon', 'l', 'liter', 'ml', 'milliliter'];
  return volumeUnits.includes(unit.toLowerCase());
}

/**
 * Canonicalize input (remove promotional text, lowercase)
 */
export function canonicalizeInput(input: string): string {
  let result = input.toLowerCase();

  // Remove promotional text
  const promoPatterns = [
    /new!/gi,
    /sale/gi,
    /\d+%\s*off/gi,
    /buy\s+\d+\s+get\s+\d+/gi,
    /save\s+\$\d+/gi,
    /\$\d+\.\d+\s*off/gi
  ];

  for (const pattern of promoPatterns) {
    result = result.replace(pattern, '');
  }

  // Normalize whitespace
  result = result.trim().replace(/\s+/g, ' ');

  return result;
}

/**
 * Canonicalize item name (for matching/deduplication)
 */
export function canonicalizeItemName(name: string): string {
  return canonicalizeInput(name)
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .trim();
}

/**
 * Calculate unit price (price / normalized quantity)
 */
export function calculateUnitPrice(
  totalPrice: number,
  normalizationResult: NormalizationResult
): number | null {
  if (!normalizationResult.success || normalizationResult.quantity === 0) {
    return null;
  }

  return totalPrice / normalizationResult.quantity;
}

/**
 * Get canonical unit for a UnitOfMeasure enum
 */
export function getCanonicalUnit(unit: UnitOfMeasure): 'oz' | 'fl_oz' | 'count' {
  switch (unit) {
    case UnitOfMeasure.OUNCES:
    case UnitOfMeasure.POUNDS:
    case UnitOfMeasure.KILOGRAMS:
    case UnitOfMeasure.GRAMS:
      return 'oz';
      
    case UnitOfMeasure.FLUID_OUNCES:
    case UnitOfMeasure.CUPS:
    case UnitOfMeasure.GALLONS:
    case UnitOfMeasure.LITERS:
    case UnitOfMeasure.MILLILITERS:
    case UnitOfMeasure.TABLESPOONS:
    case UnitOfMeasure.TEASPOONS:
      return 'fl_oz';
      
    case UnitOfMeasure.EACH:
    case UnitOfMeasure.PACK:
    case UnitOfMeasure.DOZEN:
    case UnitOfMeasure.BOX:
    case UnitOfMeasure.BAG:
    case UnitOfMeasure.BOTTLE:
    case UnitOfMeasure.CAN:
    case UnitOfMeasure.JAR:
    case UnitOfMeasure.CARTON:
    case UnitOfMeasure.CONTAINER:
    case UnitOfMeasure.OTHER:
    default:
      return 'count';
  }
}

/**
 * Convert UnitOfMeasure enum to normalized quantity
 */
export function getConversionFactor(unit: UnitOfMeasure): number {
  switch (unit) {
    // Weight
    case UnitOfMeasure.OUNCES: return 1;
    case UnitOfMeasure.POUNDS: return 16;
    case UnitOfMeasure.KILOGRAMS: return 35.274;
    case UnitOfMeasure.GRAMS: return 0.035274;
    
    // Volume
    case UnitOfMeasure.FLUID_OUNCES: return 1;
    case UnitOfMeasure.CUPS: return 8;
    case UnitOfMeasure.GALLONS: return 128;
    case UnitOfMeasure.LITERS: return 33.814;
    case UnitOfMeasure.MILLILITERS: return 0.033814;
    case UnitOfMeasure.TABLESPOONS: return 0.5; // 1 tbsp = 0.5 fl oz
    case UnitOfMeasure.TEASPOONS: return 0.1667; // 1 tsp = 0.1667 fl oz
    
    // Count (no conversion needed)
    case UnitOfMeasure.EACH:
    case UnitOfMeasure.PACK:
    case UnitOfMeasure.DOZEN:
    case UnitOfMeasure.BOX:
    case UnitOfMeasure.BAG:
    case UnitOfMeasure.BOTTLE:
    case UnitOfMeasure.CAN:
    case UnitOfMeasure.JAR:
    case UnitOfMeasure.CARTON:
    case UnitOfMeasure.CONTAINER:
    case UnitOfMeasure.OTHER:
    default:
      return 1;
  }
}

/**
 * Normalize quantity from UnitOfMeasure enum
 */
export function normalizeFromEnum(
  quantity: number,
  unit: UnitOfMeasure
): { canonicalUnit: 'oz' | 'fl_oz' | 'count'; quantity: number } {
  const canonicalUnit = getCanonicalUnit(unit);
  const conversionFactor = getConversionFactor(unit);
  
  return {
    canonicalUnit,
    quantity: quantity * conversionFactor
  };
}
