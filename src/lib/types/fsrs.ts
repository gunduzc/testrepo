/**
 * FSRS (Free Spaced Repetition Scheduler) related types
 */

/**
 * FSRS parameters for scheduling
 * Can be global (default) or per-student (optimized)
 */
export interface FSRSParameters {
  requestRetention: number;
  maximumInterval: number;
  w: number[]; // 19 weights for FSRS-5
}

/**
 * Default FSRS parameters
 * These are the default FSRS-5 parameters
 */
export const DEFAULT_FSRS_PARAMETERS: FSRSParameters = {
  requestRetention: 0.9,
  maximumInterval: 36500, // 100 years
  w: [
    0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
    0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034,
    0.6567,
  ],
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
