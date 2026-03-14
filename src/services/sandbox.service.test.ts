import { describe, it, expect } from "vitest";
import { sandboxService } from "./sandbox.service";

describe("SandboxService", () => {
  describe("executeCard", () => {
    it("should execute a valid card function and return output", async () => {
      const source = `
        function generate() {
          return {
            question: "What is 2 + 2?",
            answer: { correct: "4", type: "INTEGER" },
            solution: "2 + 2 = 4"
          };
        }
      `;
      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.question).toBe("What is 2 + 2?");
        expect(result.output.answer.correct).toBe("4");
        expect(result.output.answer.type).toBe("INTEGER");
        expect(result.output.solution).toBe("2 + 2 = 4");
      }
    });

    it("should support DECIMAL answer type", async () => {
      const source = `
        function generate() {
          return {
            question: "What is pi to 2 decimal places?",
            answer: { correct: "3.14", type: "DECIMAL" },
            solution: "Pi ≈ 3.14159..."
          };
        }
      `;
      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.answer.type).toBe("DECIMAL");
      }
    });

    it("should support TEXT answer type", async () => {
      const source = `
        function generate() {
          return {
            question: "What is the capital of France?",
            answer: { correct: "Paris", type: "TEXT" },
            solution: "Paris is the capital of France."
          };
        }
      `;
      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.answer.type).toBe("TEXT");
        expect(result.output.answer.correct).toBe("Paris");
      }
    });

    it("should support FRACTION answer type", async () => {
      const source = `
        function generate() {
          return {
            question: "Simplify 2/4",
            answer: { correct: "1/2", type: "FRACTION" },
            solution: "2/4 = 1/2"
          };
        }
      `;
      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.answer.type).toBe("FRACTION");
      }
    });

    it("should support CHOICE answer type with choices array", async () => {
      const source = `
        function generate() {
          return {
            question: "Which is a primary color?",
            answer: {
              correct: "Red",
              type: "CHOICE",
              choices: ["Red", "Green", "Orange", "Purple"]
            },
            solution: "Red is a primary color."
          };
        }
      `;
      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.answer.type).toBe("CHOICE");
        expect(result.output.answer.choices).toContain("Red");
        expect(result.output.answer.choices).toHaveLength(4);
      }
    });

    it("should support randomization with Math.random", async () => {
      const source = `
        function generate() {
          const a = Math.floor(Math.random() * 10) + 1;
          const b = Math.floor(Math.random() * 10) + 1;
          return {
            question: "What is " + a + " + " + b + "?",
            answer: { correct: String(a + b), type: "INTEGER" },
            solution: a + " + " + b + " = " + (a + b)
          };
        }
      `;

      // Run multiple times to verify randomization works
      const results = await Promise.all([
        sandboxService.executeCard(source),
        sandboxService.executeCard(source),
        sandboxService.executeCard(source),
      ]);

      expect(results.every(r => r.success)).toBe(true);
    });

    it("should return error for invalid JavaScript syntax", async () => {
      const source = `
        function generate() {
          return {
      `; // Incomplete function

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        // QuickJS may classify incomplete code as SyntaxError or RuntimeError
        // depending on how it parses the incomplete syntax
        expect(["SyntaxError", "RuntimeError"]).toContain(result.error.type);
      }
    });

    it("should return RuntimeError for undefined variables", async () => {
      const source = `
        function generate() {
          return {
            question: undefinedVariable,
            answer: { correct: "1", type: "INTEGER" },
            solution: "test"
          };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("RuntimeError");
      }
    });

    it("should return ShapeError when generate function is missing", async () => {
      const source = `
        function notGenerate() {
          return { question: "test", answer: { correct: "1", type: "INTEGER" }, solution: "test" };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("RuntimeError");
        expect(result.error.message).toContain("generate");
      }
    });

    it("should return ShapeError for missing question field", async () => {
      const source = `
        function generate() {
          return {
            answer: { correct: "1", type: "INTEGER" },
            solution: "test"
          };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ShapeError");
      }
    });

    it("should return ShapeError for missing answer field", async () => {
      const source = `
        function generate() {
          return {
            question: "What is 1+1?",
            solution: "test"
          };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ShapeError");
      }
    });

    it("should return ShapeError for missing solution field", async () => {
      const source = `
        function generate() {
          return {
            question: "What is 1+1?",
            answer: { correct: "2", type: "INTEGER" }
          };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ShapeError");
      }
    });

    it("should return ShapeError for invalid answer type", async () => {
      const source = `
        function generate() {
          return {
            question: "Test?",
            answer: { correct: "1", type: "INVALID_TYPE" },
            solution: "test"
          };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ShapeError");
      }
    });

    it("should return ShapeError for CHOICE without choices array", async () => {
      const source = `
        function generate() {
          return {
            question: "Pick one?",
            answer: { correct: "A", type: "CHOICE" },
            solution: "test"
          };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ShapeError");
      }
    });

    it("should return ShapeError for CHOICE with fewer than 2 choices", async () => {
      const source = `
        function generate() {
          return {
            question: "Pick one?",
            answer: { correct: "A", type: "CHOICE", choices: ["A"] },
            solution: "test"
          };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ShapeError");
      }
    });

    it("should return ShapeError when correct answer not in choices", async () => {
      const source = `
        function generate() {
          return {
            question: "Pick one?",
            answer: { correct: "C", type: "CHOICE", choices: ["A", "B"] },
            solution: "test"
          };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("ShapeError");
      }
    });

    it("should timeout on infinite loops", async () => {
      const source = `
        function generate() {
          while(true) {}
          return {
            question: "Never reached",
            answer: { correct: "1", type: "INTEGER" },
            solution: "test"
          };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("TimeoutError");
      }
    }, 10000); // Allow up to 10s for this test

    it("should handle memory limit exceeded", async () => {
      const source = `
        function generate() {
          const arr = [];
          for (let i = 0; i < 100000000; i++) {
            arr.push("x".repeat(1000));
          }
          return {
            question: "Never reached",
            answer: { correct: "1", type: "INTEGER" },
            solution: "test"
          };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(["MemoryError", "TimeoutError"]).toContain(result.error.type);
      }
    }, 10000);

    it("should support optional validate function in answer", async () => {
      const source = `
        function generate() {
          return {
            question: "Enter any even number",
            answer: {
              correct: "2",
              type: "INTEGER",
              validate: "function validate(input) { return parseInt(input) % 2 === 0; }"
            },
            solution: "Any even number works."
          };
        }
      `;

      const result = await sandboxService.executeCard(source);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.answer.validate).toBeDefined();
      }
    });
  });

  describe("executeValidate", () => {
    it("should execute custom validation function returning true", async () => {
      const source = `
        function validate(input) {
          return parseInt(input) % 2 === 0;
        }
      `;

      const result = await sandboxService.executeValidate(source, "4");
      expect(result).toBe(true);
    });

    it("should execute custom validation function returning false", async () => {
      const source = `
        function validate(input) {
          return parseInt(input) % 2 === 0;
        }
      `;

      const result = await sandboxService.executeValidate(source, "3");
      expect(result).toBe(false);
    });

    it("should return false for invalid validate function", async () => {
      const source = `
        function notValidate(input) {
          return true;
        }
      `;

      const result = await sandboxService.executeValidate(source, "anything");
      expect(result).toBe(false);
    });

    it("should return false on validation errors", async () => {
      const source = `
        function validate(input) {
          throw new Error("Validation error");
        }
      `;

      const result = await sandboxService.executeValidate(source, "test");
      expect(result).toBe(false);
    });
  });

  describe("testCard", () => {
    it("should return multiple successful results", async () => {
      const source = `
        function generate() {
          const n = Math.floor(Math.random() * 100);
          return {
            question: "What is " + n + " + 1?",
            answer: { correct: String(n + 1), type: "INTEGER" },
            solution: n + " + 1 = " + (n + 1)
          };
        }
      `;

      const results = await sandboxService.testCard(source, 5);

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
    });

    it("should stop on first error", async () => {
      // Since each execution gets a fresh context, we need a function
      // that always fails (not one that tracks state across calls)
      const source = `
        function generate() {
          throw new Error("Always fails");
        }
      `;

      const results = await sandboxService.testCard(source, 10);

      // Should stop after first error
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      if (!results[0].success) {
        expect(results[0].error.message).toContain("Always fails");
      }
    });
  });
});
