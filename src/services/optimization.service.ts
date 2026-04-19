/**
 * FSRSOptimizationService - Runs FSRS parameter optimization
 *
 * Uses review logs to compute optimized FSRS parameters via
 * @open-spaced-repetition/binding (Rust WASM optimizer).
 */

import prisma from "@/lib/prisma";
import {
  FSRSParameters,
  DEFAULT_FSRS_PARAMETERS,
  OptimizationStatus,
  RatingValue,
} from "@/lib/types";
import {
  computeParameters,
  FSRSBindingItem,
  FSRSBindingReview,
} from "@open-spaced-repetition/binding";

// Minimum reviews required for optimization
const MIN_REVIEWS_FOR_OPTIMIZATION = 100;

// Store optimization status in memory (in production, use Redis or DB)
let optimizationStatus: OptimizationStatus = {
  totalReviews: 0,
  isRunning: false,
};

/**
 * Builds FSRSBindingItem[] from review logs grouped by user+card
 */
function buildBindingItems(
  reviewLogs: Array<{
    userId: string;
    cardId: string;
    rating: string;
    createdAt: Date;
  }>
): FSRSBindingItem[] {
  // Group by user+card to build review sequences
  const sequences = new Map<string, { rating: number; delta_t: number }[]>();

  let lastReviewTime: Date | null = null;
  let currentKey = "";

  for (const log of reviewLogs) {
    const key = `${log.userId}:${log.cardId}`;

    if (key !== currentKey) {
      currentKey = key;
      lastReviewTime = null;
    }

    if (!sequences.has(key)) {
      sequences.set(key, []);
    }

    const rating = RatingValue[log.rating as keyof typeof RatingValue] || 3;
    const delta_t = lastReviewTime
      ? Math.max(
          0,
          Math.floor(
            (log.createdAt.getTime() - lastReviewTime.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;

    sequences.get(key)!.push({ rating, delta_t });
    lastReviewTime = log.createdAt;
  }

  // Convert to FSRSBindingItem[]
  const items: FSRSBindingItem[] = [];
  for (const reviews of sequences.values()) {
    if (reviews.length < 2) continue; // Need at least 2 reviews per card
    const bindingReviews = reviews.map(
      (r) => new FSRSBindingReview(r.rating, r.delta_t)
    );
    items.push(new FSRSBindingItem(bindingReviews));
  }

  return items;
}

export class FSRSOptimizationService {
  /**
   * Runs global parameter optimization using all review logs
   */
  async optimizeGlobal(): Promise<FSRSParameters> {
    if (optimizationStatus.isRunning) {
      throw new Error("Optimization already in progress");
    }

    optimizationStatus.isRunning = true;
    optimizationStatus.progress = 0;

    try {
      // Get all review logs ordered for sequence building
      const reviewLogs = await prisma.reviewLog.findMany({
        select: { userId: true, cardId: true, rating: true, createdAt: true },
        orderBy: [{ userId: "asc" }, { cardId: "asc" }, { createdAt: "asc" }],
      });

      optimizationStatus.totalReviews = reviewLogs.length;

      if (reviewLogs.length < MIN_REVIEWS_FOR_OPTIMIZATION) {
        throw new Error(
          `Not enough reviews for optimization. Need ${MIN_REVIEWS_FOR_OPTIMIZATION}, have ${reviewLogs.length}`
        );
      }

      optimizationStatus.progress = 25;

      const items = buildBindingItems(reviewLogs);

      if (items.length === 0) {
        throw new Error(
          "Not enough review sequences for optimization (need cards with 2+ reviews)"
        );
      }

      optimizationStatus.progress = 50;

      // Run the real FSRS optimizer
      const optimizedW = await computeParameters(items, {
        enableShortTerm: true,
      });

      optimizationStatus.progress = 100;

      const optimizedParams: FSRSParameters = {
        ...DEFAULT_FSRS_PARAMETERS,
        w: Array.from(optimizedW),
      };

      optimizationStatus.lastRunAt = new Date();
      optimizationStatus.globalParams = optimizedParams;

      return optimizedParams;
    } finally {
      optimizationStatus.isRunning = false;
    }
  }

  /**
   * Optimizes parameters for a specific student
   * Requires minimum reviews from that student
   */
  async optimizeForStudent(userId: string): Promise<FSRSParameters> {
    const reviewLogs = await prisma.reviewLog.findMany({
      where: { userId },
      select: { userId: true, cardId: true, rating: true, createdAt: true },
      orderBy: [{ cardId: "asc" }, { createdAt: "asc" }],
    });

    if (reviewLogs.length < MIN_REVIEWS_FOR_OPTIMIZATION) {
      throw new Error(
        `Not enough reviews for student optimization. Need ${MIN_REVIEWS_FOR_OPTIMIZATION}, have ${reviewLogs.length}`
      );
    }

    const items = buildBindingItems(reviewLogs);

    if (items.length === 0) {
      throw new Error(
        "Not enough review sequences for optimization (need cards with 2+ reviews)"
      );
    }

    const optimizedW = await computeParameters(items, {
      enableShortTerm: true,
    });

    const optimizedParams: FSRSParameters = {
      ...DEFAULT_FSRS_PARAMETERS,
      w: Array.from(optimizedW),
    };

    // Save to user record
    await prisma.user.update({
      where: { id: userId },
      data: {
        fsrsParameters: JSON.stringify(optimizedParams),
      },
    });

    return optimizedParams;
  }

  /**
   * Gets current optimization status
   */
  async getOptimizationStatus(): Promise<OptimizationStatus> {
    const totalReviews = await prisma.reviewLog.count();

    return {
      ...optimizationStatus,
      totalReviews,
    };
  }

  /**
   * Resets student to global parameters
   */
  async resetStudentParameters(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { fsrsParameters: null },
    });
  }
}

// Singleton instance
export const optimizationService = new FSRSOptimizationService();
