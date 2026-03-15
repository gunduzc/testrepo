/**
 * Import/Export JSON schemas
 */

import { AnswerType } from "./enums";

/**
 * Card export format
 */
export interface CardExportJSON {
  version: "1.0";
  type: "card";
  data: {
    name: string;
    description: string;
    functionSource: string;
    answerType: AnswerType;
    learningSteps: number;
    relearningSteps: number;
    reviewSteps: number;
    tags: string[];
  };
}

/**
 * Subject export format with all cards
 */
export interface SubjectExportJSON {
  version: "1.0";
  type: "subject";
  data: {
    name: string;
    description?: string;
    cards: CardExportJSON["data"][];
  };
}

/**
 * Curriculum export format with all subjects and prerequisites
 */
export interface CurriculumExportJSON {
  version: "1.0";
  type: "curriculum";
  data: {
    name: string;
    description?: string;
    subjects: {
      id: string; // Temporary ID for prerequisite references
      name: string;
      description?: string;
      cards: CardExportJSON["data"][];
    }[];
    prerequisites: {
      subjectId: string;
      prerequisiteId: string;
    }[];
  };
}

/**
 * Import result with validation info
 */
export interface ImportResult<T> {
  success: boolean;
  data?: T;
  errors?: ImportError[];
}

/**
 * Import error details
 */
export interface ImportError {
  path: string; // JSON path to the error
  message: string;
  code: "INVALID_JSON" | "MISSING_FIELD" | "INVALID_CARD" | "DAG_CYCLE" | "VALIDATION_ERROR";
}
