import { describe, it, expect, vi } from "vitest";
import { validationService } from "./validation.service";

// Mock sandbox service to avoid actual sandbox execution
vi.mock("./sandbox.service", () => ({
  sandboxService: {
    executeValidate: vi.fn(),
  },
}));

describe("AnswerValidationService", () => {
  describe("INTEGER validation", () => {
    it("should match equal integers", async () => {
      expect(await validationService.validate("42", "42", "INTEGER")).toBe(true);
    });

    it("should match integers with whitespace", async () => {
      expect(await validationService.validate("  42  ", "42", "INTEGER")).toBe(true);
    });

    it("should match negative integers", async () => {
      expect(await validationService.validate("-5", "-5", "INTEGER")).toBe(true);
    });

    it("should reject non-matching integers", async () => {
      expect(await validationService.validate("42", "43", "INTEGER")).toBe(false);
    });

    it("should reject invalid integer input", async () => {
      expect(await validationService.validate("abc", "42", "INTEGER")).toBe(false);
    });

    it("should handle leading zeros", async () => {
      expect(await validationService.validate("007", "7", "INTEGER")).toBe(true);
    });
  });

  describe("DECIMAL validation", () => {
    it("should match equal decimals", async () => {
      expect(await validationService.validate("3.14", "3.14", "DECIMAL")).toBe(true);
    });

    it("should match within epsilon", async () => {
      expect(await validationService.validate("3.14159265358979", "3.14159265358979", "DECIMAL")).toBe(true);
    });

    it("should reject non-matching decimals", async () => {
      expect(await validationService.validate("3.14", "3.15", "DECIMAL")).toBe(false);
    });

    it("should handle integer as decimal", async () => {
      expect(await validationService.validate("5", "5.0", "DECIMAL")).toBe(true);
    });

    it("should reject invalid decimal input", async () => {
      expect(await validationService.validate("abc", "3.14", "DECIMAL")).toBe(false);
    });
  });

  describe("TEXT validation", () => {
    it("should match case-insensitively", async () => {
      expect(await validationService.validate("Hello", "hello", "TEXT")).toBe(true);
    });

    it("should trim whitespace", async () => {
      expect(await validationService.validate("  hello  ", "hello", "TEXT")).toBe(true);
    });

    it("should reject different text", async () => {
      expect(await validationService.validate("hello", "world", "TEXT")).toBe(false);
    });

    it("should match mixed case", async () => {
      expect(await validationService.validate("HeLLo WoRLd", "hello world", "TEXT")).toBe(true);
    });
  });

  describe("FRACTION validation", () => {
    it("should match equal fractions", async () => {
      expect(await validationService.validate("1/2", "1/2", "FRACTION")).toBe(true);
    });

    it("should reduce fractions to lowest terms", async () => {
      expect(await validationService.validate("2/4", "1/2", "FRACTION")).toBe(true);
    });

    it("should handle whole numbers", async () => {
      expect(await validationService.validate("4", "4/1", "FRACTION")).toBe(true);
    });

    it("should handle negative fractions", async () => {
      expect(await validationService.validate("-1/2", "-1/2", "FRACTION")).toBe(true);
    });

    it("should normalize negative denominator", async () => {
      expect(await validationService.validate("1/-2", "-1/2", "FRACTION")).toBe(true);
    });

    it("should reject non-matching fractions", async () => {
      expect(await validationService.validate("1/2", "1/3", "FRACTION")).toBe(false);
    });

    it("should reject invalid fractions", async () => {
      expect(await validationService.validate("1/0", "1/2", "FRACTION")).toBe(false);
    });

    it("should reduce complex fractions", async () => {
      expect(await validationService.validate("12/16", "3/4", "FRACTION")).toBe(true);
    });
  });

  describe("CHOICE validation", () => {
    it("should match exact choice", async () => {
      expect(await validationService.validate("A", "A", "CHOICE")).toBe(true);
    });

    it("should be case-sensitive", async () => {
      expect(await validationService.validate("a", "A", "CHOICE")).toBe(false);
    });

    it("should reject non-matching choice", async () => {
      expect(await validationService.validate("A", "B", "CHOICE")).toBe(false);
    });
  });

  // Edge case tests that might expose bugs
  describe("Edge cases", () => {
    describe("INTEGER edge cases", () => {
      it("should handle very large integers", async () => {
        expect(await validationService.validate("999999999999", "999999999999", "INTEGER")).toBe(true);
      });

      it("should handle zero", async () => {
        expect(await validationService.validate("0", "0", "INTEGER")).toBe(true);
      });

      it("should handle negative zero", async () => {
        expect(await validationService.validate("-0", "0", "INTEGER")).toBe(true);
      });

      it("should reject float input for INTEGER type", async () => {
        // Float input should be rejected for INTEGER type
        const result = await validationService.validate("3.14", "3", "INTEGER");
        expect(result).toBe(false);
      });

      it("should handle scientific notation", async () => {
        // parseInt("1e5") returns 1, not 100000!
        const result = await validationService.validate("1e5", "100000", "INTEGER");
        // This will likely FAIL because parseInt doesn't handle scientific notation
        expect(result).toBe(true);
      });
    });

    describe("DECIMAL edge cases", () => {
      it("should handle very small differences within epsilon", async () => {
        // epsilon is 1e-9, so this should pass
        expect(await validationService.validate("1.0000000001", "1.0000000002", "DECIMAL")).toBe(true);
      });

      it("should reject differences larger than epsilon", async () => {
        // This difference is larger than 1e-9
        expect(await validationService.validate("1.000001", "1.000002", "DECIMAL")).toBe(false);
      });

      it("should handle scientific notation", async () => {
        expect(await validationService.validate("1e-5", "0.00001", "DECIMAL")).toBe(true);
      });

      it("should handle Infinity", async () => {
        const result = await validationService.validate("Infinity", "Infinity", "DECIMAL");
        // NaN check: Infinity - Infinity = NaN, |NaN| < epsilon is false
        expect(result).toBe(false);
      });

      it("should handle NaN input", async () => {
        expect(await validationService.validate("NaN", "0", "DECIMAL")).toBe(false);
      });

      // Potential bug: very strict epsilon might reject visually equal decimals
      it("should handle typical decimal precision issues", async () => {
        // 0.1 + 0.2 = 0.30000000000000004 in JS
        // This tests if the epsilon is too strict for real-world use
        const result = await validationService.validate("0.30000000000000004", "0.3", "DECIMAL");
        expect(result).toBe(true);
      });
    });

    describe("FRACTION edge cases", () => {
      it("should handle zero numerator", async () => {
        expect(await validationService.validate("0/5", "0/1", "FRACTION")).toBe(true);
      });

      it("should reject division by zero", async () => {
        expect(await validationService.validate("5/0", "1/1", "FRACTION")).toBe(false);
      });

      it("should handle double negative", async () => {
        // -1/-2 should equal 1/2
        expect(await validationService.validate("-1/-2", "1/2", "FRACTION")).toBe(true);
      });

      it("should handle large fractions", async () => {
        expect(await validationService.validate("100000/200000", "1/2", "FRACTION")).toBe(true);
      });

      it("should handle improper fractions", async () => {
        expect(await validationService.validate("5/2", "5/2", "FRACTION")).toBe(true);
      });

      it("should reject invalid fraction format", async () => {
        expect(await validationService.validate("1/2/3", "1/2", "FRACTION")).toBe(false);
      });
    });

    describe("TEXT edge cases", () => {
      it("should handle empty strings", async () => {
        expect(await validationService.validate("", "", "TEXT")).toBe(true);
      });

      it("should handle only whitespace", async () => {
        expect(await validationService.validate("   ", "", "TEXT")).toBe(true);
      });

      it("should handle unicode characters", async () => {
        expect(await validationService.validate("café", "CAFÉ", "TEXT")).toBe(true);
      });

      it("should handle special characters", async () => {
        expect(await validationService.validate("hello!", "hello!", "TEXT")).toBe(true);
      });

      it("should handle newlines", async () => {
        // Trim only removes leading/trailing whitespace, not internal
        expect(await validationService.validate("hello\nworld", "hello\nworld", "TEXT")).toBe(true);
      });
    });

    describe("Unknown type", () => {
      it("should return false for unknown answer type", async () => {
        expect(await validationService.validate("test", "test", "UNKNOWN" as any)).toBe(false);
      });
    });
  });
});
