/**
 * FSRS (Free Spaced Repetition Scheduler) related types
 */

import { generatorParameters } from "ts-fsrs";

/**
 * FSRS parameters for scheduling
 * Can be global (default) or per-student (optimized)
 */
export interface FSRSParameters {
  requestRetention: number;
  maximumInterval: number;
  w: number[]; // 21 weights for FSRS-6
}

/**
 * Default FSRS parameters from ts-fsrs
 */
const defaults = generatorParameters();
export const DEFAULT_FSRS_PARAMETERS: FSRSParameters = {
  requestRetention: 0.9,
  maximumInterval: 36500, // 100 years
  w: [...defaults.w],
};

/**
 * Optimization status
 */
export interface OptimizationStatus {
  lastRunAt?: Date;
  totalReviews: number;
  isRunning: boolean;
  progress?: number; // 0-100 percentage
  globalParams?: FSRSParameters;
}

/**
 * Review item format for FSRS optimizer
 * Matches the ts-fsrs library format
 */
export interface FSRSReviewItem {
  rating: 1 | 2 | 3 | 4; // AGAIN=1, HARD=2, GOOD=3, EASY=4
  delta_t: number; // Days since last review
}

/**
 * Review history for a card (for optimization)
 */
export interface CardReviewHistory {
  cardId: string;
  reviews: FSRSReviewItem[];
}
