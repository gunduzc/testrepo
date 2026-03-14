/**
 * Study session related types
 */

import { AnswerType, CardState, Rating } from "./enums";

/**
 * Question presentation sent to client
 * Note: correctAnswer and solution are only included in preview mode
 */
export interface QuestionPresentation {
  sessionId: string;
  cardId: string;
  question: string;
  answerType: AnswerType;
  choices?: string[];
  cardName: string;
  subjectName?: string;
  /** Only included in preview mode for educators */
  correctAnswer?: string;
  /** Only included in preview mode for educators */
  solution?: string;
}

/**
 * Result of answer submission
 */
export interface SubmissionResult {
  correct: boolean;
  correctAnswer: string;
  /** Solution/explanation shown after submission */
  solution: string;
  /** Only present in regular study mode */
  rating?: Rating;
  progress: Partial<ProgressSummary>;
  /** Only present in regular study mode */
  nextState?: CardState;
  canUndo?: boolean;
}

/**
 * Progress summary for a curriculum
 */
export interface ProgressSummary {
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  relearningCards: number;
  masteredCards: number;
  dueCards: number;
  completionPercentage: number;
  subjectProgress: SubjectProgressSummary[];
}

/**
 * Progress for a single subject
 */
export interface SubjectProgressSummary {
  subjectId: string;
  subjectName: string;
  totalCards: number;
  masteredCards: number;
  dueCards: number;
  isUnlocked: boolean;
  completionPercentage: number;
}

/**
 * Card with its FSRS scheduling info for next card selection
 */
export interface ScheduledCard {
  cardId: string;
  card: {
    id: string;
    name: string;
    functionSource: string;
    answerType: AnswerType;
    learningSteps: number;
    relearningSteps: number;
    reviewSteps: number;
    description: string;
  };
  state: CardState;
  due: Date;
  isNew: boolean;
  subjectId: string;
  subjectName: string;
  position: number;
  /** Current step progress (correct answers so far) */
  currentStep: number;
  /** Required steps based on current state */
  requiredSteps: number;
}

/**
 * Active study session data stored server-side
 */
export interface ActiveSessionData {
  sessionId: string;
  userId: string;
  cardId: string;
  correctAnswer: string;
  answerType: AnswerType;
  validateFnSource?: string;
  presentedAt: Date;
  expiresAt: Date;
}
