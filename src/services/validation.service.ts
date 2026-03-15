/**
 * AnswerValidationService - Validates student answers
 *
 * Supports type-based normalization and custom validation functions
 *
 * Normalization rules:
 * - INTEGER: Parse as int, ignore leading zeros/whitespace
 * - DECIMAL: Parse as float, epsilon 1e-9
 * - TEXT: Trim, case-insensitive
 * - FRACTION: Reduce to lowest terms
 * - CHOICE: Exact match (case-sensitive)
 */

import { AnswerType } from "@/lib/types";
import { sandboxService } from "./sandbox.service";

/**
 * Computes GCD for fraction reduction
 */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/**
 * Normalizes a fraction string to lowest terms
 * Handles: "2/4" -> "1/2", "4" -> "4/1", "-2/4" -> "-1/2"
 */
function normalizeFraction(input: string): string | null {
  const trimmed = input.trim();

  // Handle whole numbers
  if (!trimmed.includes("/")) {
    const num = parseInt(trimmed, 10);
    if (isNaN(num)) return null;
    return `${num}/1`;
  }

  const parts = trimmed.split("/");
  if (parts.length !== 2) return null;

  const numerator = parseInt(parts[0].trim(), 10);
  const denominator = parseInt(parts[1].trim(), 10);

  if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
    return null;
  }

  const divisor = gcd(numerator, denominator);
  let reducedNum = numerator / divisor;
  let reducedDen = denominator / divisor;

  // Normalize sign to numerator
  if (reducedDen < 0) {
    reducedNum = -reducedNum;
    reducedDen = -reducedDen;
  }

  return `${reducedNum}/${reducedDen}`;
}

/**
 * Normalizes an integer string
 * Uses parseFloat first to handle scientific notation (1e5 = 100000),
 * then checks if it's actually an integer
 */
function normalizeInteger(input: string): number | null {
  const trimmed = input.trim();
  const num = parseFloat(trimmed);
  if (isNaN(num) || !isFinite(num)) return null;
  // Check if it's actually an integer (no fractional part)
  if (!Number.isInteger(num)) return null;
  return num;
}

/**
 * Normalizes a decimal string
 */
function normalizeDecimal(input: string): number | null {
  const trimmed = input.trim();
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

/**
 * Normalizes text for comparison
 */
function normalizeText(input: string): string {
  return input.trim().toLowerCase();
}

const DECIMAL_EPSILON = 1e-9;

export class AnswerValidationService {
  /**
   * Validates student answer against correct answer
   *
   * @param input - Student's answer
   * @param correct - Correct answer
   * @param answerType - Type of answer
   * @param validateFnSource - Optional custom validation function
   */
  async validate(
    input: string,
    correct: string,
    answerType: AnswerType,
    validateFnSource?: string
  ): Promise<boolean> {
    // Use custom validation if provided
    if (validateFnSource) {
      try {
        return await sandboxService.executeValidate(validateFnSource, input);
      } catch {
        // Fall back to type-based validation on error
      }
    }

    // Type-based validation
    switch (answerType) {
      case "INTEGER": {
        const studentNum = normalizeInteger(input);
        const correctNum = normalizeInteger(correct);
        if (studentNum === null || correctNum === null) return false;
        return studentNum === correctNum;
      }

      case "DECIMAL": {
        const studentNum = normalizeDecimal(input);
        const correctNum = normalizeDecimal(correct);
        if (studentNum === null || correctNum === null) return false;
        return Math.abs(studentNum - correctNum) < DECIMAL_EPSILON;
      }

      case "TEXT": {
        return normalizeText(input) === normalizeText(correct);
      }

      case "FRACTION": {
        const studentFrac = normalizeFraction(input);
        const correctFrac = normalizeFraction(correct);
        if (studentFrac === null || correctFrac === null) return false;
        return studentFrac === correctFrac;
      }

      case "CHOICE": {
        // Exact match for choices (case-sensitive)
        return input === correct;
      }

      default:
        return false;
    }
  }
}

// Singleton instance
export const validationService = new AnswerValidationService();
