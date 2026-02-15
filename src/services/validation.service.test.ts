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
});
