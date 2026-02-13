/**
 * Card-related types for sandbox execution and card management
 */

import { AnswerType } from "./enums";

/**
 * Output from executing a card function in the sandbox
 */
export interface CardOutput {
  question: string;
  answer: {
    correct: string;
    type: AnswerType;
    choices?: string[];
    validate?: string; // Optional custom validation function source
  };
}

/**
 * Error from sandbox execution
 */
export interface SandboxError {
  type: "SyntaxError" | "TimeoutError" | "MemoryError" | "ShapeError" | "RuntimeError";
  message: string;
  line?: number;
  stack?: string;
}

/**
 * Result of sandbox execution - either success or error
 */
export type SandboxResult =
  | { success: true; output: CardOutput }
  | { success: false; error: SandboxError };

/**
 * DTO for creating a new card
 */
export interface CreateCardDTO {
  functionSource: string;
  name: string;
  description: string;
  answerType: AnswerType;
  learningSteps?: number;
  relearningSteps?: number;
  tags?: string[];
  subjectId?: string;
  position?: number;
  authoringHistory?: AuthoringHistoryEntry[];
}

/**
 * DTO for updating a card
 */
export interface UpdateCardDTO {
  functionSource?: string;
  name?: string;
  description?: string;
  answerType?: AnswerType;
  learningSteps?: number;
  relearningSteps?: number;
  tags?: string[];
}

/**
 * Authoring history entry types
 */
export type AuthoringHistoryEntryType =
  | "prompt"
  | "generation"
  | "flag"
  | "correction"
  | "approval";

/**
 * Entry in the authoring history for LLM-created cards
 */
export interface AuthoringHistoryEntry {
  type: AuthoringHistoryEntryType;
  content: string;
  timestamp: string;
  sampleIndex?: number;
}

/**
 * Flagged sample from LLM authoring
 */
export interface FlaggedSample {
  sampleIndex: number;
  generatedQuestion: string;
  generatedAnswer: string;
  correctedAnswer?: string;
  comment?: string;
}
