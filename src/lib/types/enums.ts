/**
 * Enums for the Spaced Repetition Learning Platform
 * SQLite doesn't support native enums, so we use string constants with TypeScript types
 */

// User roles
export const Role = {
  ADMIN: "ADMIN",
  EDUCATOR: "EDUCATOR",
  STUDENT: "STUDENT",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

// Answer types for cards
export const AnswerType = {
  INTEGER: "INTEGER",
  DECIMAL: "DECIMAL",
  TEXT: "TEXT",
  FRACTION: "FRACTION",
  CHOICE: "CHOICE",
} as const;
export type AnswerType = (typeof AnswerType)[keyof typeof AnswerType];

// FSRS card states
export const CardState = {
  NEW: "NEW",
  LEARNING: "LEARNING",
  REVIEW: "REVIEW",
  RELEARNING: "RELEARNING",
} as const;
export type CardState = (typeof CardState)[keyof typeof CardState];

// FSRS ratings
export const Rating = {
  AGAIN: "AGAIN",
  HARD: "HARD",
  GOOD: "GOOD",
  EASY: "EASY",
} as const;
export type Rating = (typeof Rating)[keyof typeof Rating];

// Mapping FSRS library ratings to our strings
export const RatingValue = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4,
} as const;

export const ValueToRating: Record<number, Rating> = {
  1: Rating.AGAIN,
  2: Rating.HARD,
  3: Rating.GOOD,
  4: Rating.EASY,
};
