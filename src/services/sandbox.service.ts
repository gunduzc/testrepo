/**
 * SandboxService - Executes card JavaScript in isolated V8 instances
 *
 * Security constraints:
 * - 8 MB heap limit
 * - 1 second timeout
 * - No host APIs (no require, fs, network)
 * - Fresh isolate per execution
 */

import ivm from "isolated-vm";
import { CardOutput, SandboxError, SandboxResult, AnswerType } from "@/lib/types";

// Sandbox configuration
const MEMORY_LIMIT_MB = 8;
const TIMEOUT_MS = 1000;

/**
 * Validates that the output matches the expected CardOutput shape
 */
function validateCardOutput(output: unknown): output is CardOutput {
  if (typeof output !== "object" || output === null) {
    return false;
  }

  const obj = output as Record<string, unknown>;

  if (typeof obj.question !== "string" || obj.question.length === 0) {
    return false;
  }

  if (typeof obj.answer !== "object" || obj.answer === null) {
    return false;
  }

  const answer = obj.answer as Record<string, unknown>;

  if (typeof answer.correct !== "string") {
    return false;
  }

  const validTypes: AnswerType[] = ["INTEGER", "DECIMAL", "TEXT", "FRACTION", "CHOICE"];
  if (!validTypes.includes(answer.type as AnswerType)) {
    return false;
  }

  if (answer.type === "CHOICE") {
    if (!Array.isArray(answer.choices) || answer.choices.length < 2) {
      return false;
    }
    if (!answer.choices.every((c: unknown) => typeof c === "string")) {
      return false;
    }
    if (!answer.choices.includes(answer.correct)) {
      return false;
    }
  }

  if (answer.validate !== undefined && typeof answer.validate !== "string") {
    return false;
  }

  if (typeof obj.solution !== "string") {
    return false;
  }

  return true;
}

/**
 * Extracts line number from V8 error stack
 */
function extractLineNumber(stack: string | undefined): number | undefined {
  if (!stack) return undefined;
  const match = stack.match(/:(\d+):\d+/);
  return match ? parseInt(match[1], 10) : undefined;
}

export class SandboxService {
  /**
   * Executes a card function in a fresh V8 isolate
   * Returns the question-answer pair
   */
  async executeCard(source: string): Promise<SandboxResult> {
    const isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });

    try {
      const context = await isolate.createContext();
      const jail = context.global;

      // Expose a random function that can be called synchronously from inside the isolate
      // Using a callback reference that the isolate can call
      await jail.set(
        "_getRandomNumber",
        new ivm.Callback(() => Math.random())
      );

      // Create the wrapper that calls the card function
      const wrappedSource = `
        const Math = {
          random: () => _getRandomNumber(),
          floor: (x) => globalThis.Math.floor(x),
          ceil: (x) => globalThis.Math.ceil(x),
          round: (x) => globalThis.Math.round(x),
          abs: (x) => globalThis.Math.abs(x),
          min: (...args) => globalThis.Math.min(...args),
          max: (...args) => globalThis.Math.max(...args),
          pow: (x, y) => globalThis.Math.pow(x, y),
          sqrt: (x) => globalThis.Math.sqrt(x),
          PI: globalThis.Math.PI,
          E: globalThis.Math.E,
        };

        ${source}

        // The card function must be named 'generate'
        if (typeof generate !== 'function') {
          throw new Error('Card must export a function named "generate"');
        }

        JSON.stringify(generate());
      `;

      const script = await isolate.compileScript(wrappedSource);
      const resultJson = await script.run(context, { timeout: TIMEOUT_MS });

      if (typeof resultJson !== "string") {
        return {
          success: false,
          error: {
            type: "ShapeError",
            message: "Card function must return an object, got: " + typeof resultJson,
          },
        };
      }

      let output: unknown;
      try {
        output = JSON.parse(resultJson);
      } catch {
        return {
          success: false,
          error: {
            type: "ShapeError",
            message: "Card function returned invalid JSON",
          },
        };
      }

      if (!validateCardOutput(output)) {
        return {
          success: false,
          error: {
            type: "ShapeError",
            message:
              "Invalid card output shape. Expected { question: string, answer: { correct: string, type: AnswerType, choices?: string[], validate?: string }, solution: string }",
          },
        };
      }

      return { success: true, output };
    } catch (err) {
      const error = err as Error;

      if (error.message?.includes("Script execution timed out")) {
        return {
          success: false,
          error: {
            type: "TimeoutError",
            message: "Execution timed out after 1 second",
          },
        };
      }

      if (error.message?.includes("memory limit")) {
        return {
          success: false,
          error: {
            type: "MemoryError",
            message: "Memory limit exceeded (8 MB)",
          },
        };
      }

      if (error.name === "SyntaxError" || error.message?.includes("SyntaxError")) {
        return {
          success: false,
          error: {
            type: "SyntaxError",
            message: error.message,
            line: extractLineNumber(error.stack),
          },
        };
      }

      return {
        success: false,
        error: {
          type: "RuntimeError",
          message: error.message || "Unknown runtime error",
          stack: error.stack,
          line: extractLineNumber(error.stack),
        },
      };
    } finally {
      isolate.dispose();
    }
  }

  /**
   * Executes a custom validate function with student input
   */
  async executeValidate(source: string, studentInput: string): Promise<boolean> {
    const isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });

    try {
      const context = await isolate.createContext();

      const wrappedSource = `
        ${source}

        if (typeof validate !== 'function') {
          throw new Error('Validate function must be named "validate"');
        }

        validate(${JSON.stringify(studentInput)}) ? 'true' : 'false';
      `;

      const script = await isolate.compileScript(wrappedSource);
      const result = await script.run(context, { timeout: TIMEOUT_MS });

      return result === "true";
    } catch {
      // On any error in custom validation, return false
      return false;
    } finally {
      isolate.dispose();
    }
  }

  /**
   * Tests a card function by executing it multiple times
   * Returns all outputs for preview during authoring
   */
  async testCard(source: string, count: number = 10): Promise<SandboxResult[]> {
    const results: SandboxResult[] = [];

    for (let i = 0; i < count; i++) {
      const result = await this.executeCard(source);
      results.push(result);

      // Stop on first error
      if (!result.success) {
        break;
      }
    }

    return results;
  }
}

// Singleton instance
export const sandboxService = new SandboxService();
