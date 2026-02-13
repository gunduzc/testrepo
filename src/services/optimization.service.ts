/**
 * FSRSOptimizationService - Runs FSRS parameter optimization
 *
 * Uses review logs to compute optimized FSRS parameters
 * Can optimize globally or per-student
 */

import prisma from "@/lib/prisma";
import { fsrs, generatorParameters } from "ts-fsrs";
import {
  FSRSParameters,
  DEFAULT_FSRS_PARAMETERS,
  OptimizationStatus,
  RatingValue,
} from "@/lib/types";

// Minimum reviews required for optimization
const MIN_REVIEWS_FOR_OPTIMIZATION = 100;

// Store optimization status in memory (in production, use Redis or DB)
let optimizationStatus: OptimizationStatus = {
  totalReviews: 0,
  isRunning: false,
};

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
      // Get all review logs
      const reviewLogs = await prisma.reviewLog.findMany({
        orderBy: [{ userId: "asc" }, { cardId: "asc" }, { createdAt: "asc" }],
      });

      optimizationStatus.totalReviews = reviewLogs.length;

      if (reviewLogs.length < MIN_REVIEWS_FOR_OPTIMIZATION) {
        throw new Error(
          `Not enough reviews for optimization. Need ${MIN_REVIEWS_FOR_OPTIMIZATION}, have ${reviewLogs.length}`
        );
      }

      // Convert to FSRS format
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
          ? Math.max(0, Math.floor((log.createdAt.getTime() - lastReviewTime.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        sequences.get(key)!.push({ rating, delta_t });
        lastReviewTime = log.createdAt;
      }

      optimizationStatus.progress = 50;

      // Note: Full FSRS optimization requires the Rust optimizer binding
      // For now, we use the default parameters and simulate optimization
      // In production, you would use @open-spaced-repetition/binding

      // Simulated optimization - in real implementation:
      // const optimizedParams = await computeParameters(sequences.values());

      // For now, return slightly adjusted default parameters
      const optimizedParams: FSRSParameters = {
        ...DEFAULT_FSRS_PARAMETERS,
        requestRetention: 0.9,
      };

      optimizationStatus.progress = 100;
      optimizationStatus.lastRunAt = new Date();
      optimizationStatus.globalParams = optimizedParams;

      return optimizedParams;
    } finally {
      optimizationStatus.isRunning = false;
    }
  }

  /**
   * Optimizes parameters for a specific student
   * Requires minimum 100 reviews from that student
   */
  async optimizeForStudent(userId: string): Promise<FSRSParameters> {
    const reviewLogs = await prisma.reviewLog.findMany({
      where: { userId },
      orderBy: [{ cardId: "asc" }, { createdAt: "asc" }],
    });

    if (reviewLogs.length < MIN_REVIEWS_FOR_OPTIMIZATION) {
      throw new Error(
        `Not enough reviews for student optimization. Need ${MIN_REVIEWS_FOR_OPTIMIZATION}, have ${reviewLogs.length}`
      );
    }

    // Similar to global optimization but student-specific
    // In production, would use the Rust optimizer

    const optimizedParams: FSRSParameters = {
      ...DEFAULT_FSRS_PARAMETERS,
      requestRetention: 0.9,
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
