/**
 * SandboxService - Executes card JavaScript in QuickJS WASM sandbox
 *
 * Security constraints:
 * - 8 MB heap limit
 * - 1 second timeout
 * - No host APIs (no require, fs, network)
 * - Fresh context per execution
 * - WASM isolation (separate engine, not V8)
 */

import {
  getQuickJS,
  shouldInterruptAfterDeadline,
  QuickJSWASMModule,
  QuickJSContext,
} from "quickjs-emscripten";
import { CardOutput, SandboxError, SandboxResult, AnswerType } from "@/lib/types";

// Sandbox configuration
const MEMORY_LIMIT_BYTES = 8 * 1024 * 1024; // 8 MB
const TIMEOUT_MS = 1000;

// Singleton QuickJS module (loaded once, reused)
let quickJS: QuickJSWASMModule | null = null;

async function getQuickJSModule(): Promise<QuickJSWASMModule> {
  if (!quickJS) {
    quickJS = await getQuickJS();
  }
  return quickJS;
}

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
 * Extracts line number from error message or stack
 */
function extractLineNumber(message: string): number | undefined {
  // QuickJS format: "at <eval> (eval.js:LINE:COL)" or just ":LINE:"
  const match = message.match(/:(\d+)(?::\d+)?/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Sets up a QuickJS context with Math.random from host
 */
function setupContext(vm: QuickJSContext): void {
  // Expose Math.random via host callback
  const randomFn = vm.newFunction("random", () => {
    return vm.newNumber(Math.random());
  });

  // Get or create Math object and add our random
  const mathObj = vm.getProp(vm.global, "Math");
  vm.setProp(mathObj, "random", randomFn);

  randomFn.dispose();
  mathObj.dispose();
}

export class SandboxService {
  /**
   * Executes a card function in a fresh QuickJS context
   * Returns the question-answer pair
   */
  async executeCard(source: string): Promise<SandboxResult> {
    const QuickJS = await getQuickJSModule();
    const runtime = QuickJS.newRuntime();

    runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    runtime.setInterruptHandler(
      shouldInterruptAfterDeadline(Date.now() + TIMEOUT_MS)
    );

    const vm = runtime.newContext();

    try {
      setupContext(vm);

      const wrappedSource = `
        ${source}

        // The card function must be named 'generate'
        if (typeof generate !== 'function') {
          throw new Error('Card must export a function named "generate"');
        }

        JSON.stringify(generate());
      `;

      const result = vm.evalCode(wrappedSource);

      if (result.error) {
        const errorObj = vm.dump(result.error);
        result.error.dispose();

        const message = typeof errorObj === "object" && errorObj !== null
          ? (errorObj as { message?: string }).message || String(errorObj)
          : String(errorObj);

        // Detect error types
        if (message.includes("interrupted")) {
          return {
            success: false,
            error: {
              type: "TimeoutError",
              message: "Execution timed out after 1 second",
            },
          };
        }

        if (message.includes("memory") || message.includes("allocation")) {
          return {
            success: false,
            error: {
              type: "MemoryError",
              message: "Memory limit exceeded (8 MB)",
            },
          };
        }

        if (message.includes("SyntaxError") || message.includes("unexpected")) {
          return {
            success: false,
            error: {
              type: "SyntaxError",
              message,
              line: extractLineNumber(message),
            },
          };
        }

        return {
          success: false,
          error: {
            type: "RuntimeError",
            message,
            line: extractLineNumber(message),
          },
        };
      }

      const resultJson = vm.dump(result.value);
      result.value.dispose();

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
    } finally {
      vm.dispose();
      runtime.dispose();
    }
  }

  /**
   * Executes a custom validate function with student input
   */
  async executeValidate(source: string, studentInput: string): Promise<boolean> {
    const QuickJS = await getQuickJSModule();
    const runtime = QuickJS.newRuntime();

    runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    runtime.setInterruptHandler(
      shouldInterruptAfterDeadline(Date.now() + TIMEOUT_MS)
    );

    const vm = runtime.newContext();

    try {
      const wrappedSource = `
        ${source}

        if (typeof validate !== 'function') {
          throw new Error('Validate function must be named "validate"');
        }

        validate(${JSON.stringify(studentInput)}) ? 'true' : 'false';
      `;

      const result = vm.evalCode(wrappedSource);

      if (result.error) {
        result.error.dispose();
        return false;
      }

      const value = vm.dump(result.value);
      result.value.dispose();

      return value === "true";
    } catch {
      return false;
    } finally {
      vm.dispose();
      runtime.dispose();
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
