/**
 * User Statistics API
 * GET /api/user/stats - Get study statistics for current user
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface DailyStats {
  date: string;
  reviews: number;
  correct: number;
  avgResponseMs: number;
}

interface StudyStats {
  totalReviews: number;
  totalCorrect: number;
  overallAccuracy: number;
  averageResponseMs: number;
  cardsStudied: number;
  cardsMastered: number;
  currentStreak: number;
  longestStreak: number;
  dailyStats: DailyStats[];
  recentActivity: {
    today: number;
    yesterday: number;
    thisWeek: number;
    thisMonth: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get aggregate stats
    const [
      totalStats,
      cardsStudied,
      cardsMastered,
      todayReviews,
      yesterdayReviews,
      weekReviews,
      monthReviews,
    ] = await Promise.all([
      prisma.reviewLog.aggregate({
        where: { userId },
        _count: { id: true },
        _avg: { responseTimeMs: true },
      }),
      prisma.studentCardState.count({
        where: { userId },
      }),
      prisma.studentCardState.count({
        where: { userId, state: "REVIEW", stability: { gt: 10 } },
      }),
      prisma.reviewLog.count({
        where: { userId, createdAt: { gte: todayStart } },
      }),
      prisma.reviewLog.count({
        where: { userId, createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      prisma.reviewLog.count({
        where: { userId, createdAt: { gte: weekStart } },
      }),
      prisma.reviewLog.count({
        where: { userId, createdAt: { gte: monthStart } },
      }),
    ]);

    // Get correct count
    const correctCount = await prisma.reviewLog.count({
      where: { userId, correct: true },
    });

    // Get daily stats for the last 30 days
    const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentReviews = await prisma.reviewLog.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, correct: true, responseTimeMs: true },
      orderBy: { createdAt: "asc" },
    });

    // Group by day
    const dailyStatsMap = new Map<string, { reviews: number; correct: number; totalMs: number }>();
    for (const review of recentReviews) {
      const date = review.createdAt.toISOString().split("T")[0];
      const existing = dailyStatsMap.get(date) || { reviews: 0, correct: 0, totalMs: 0 };
      existing.reviews++;
      if (review.correct) existing.correct++;
      existing.totalMs += review.responseTimeMs;
      dailyStatsMap.set(date, existing);
    }

    const dailyStats: DailyStats[] = Array.from(dailyStatsMap.entries()).map(([date, stats]) => ({
      date,
      reviews: stats.reviews,
      correct: stats.correct,
      avgResponseMs: stats.reviews > 0 ? Math.round(stats.totalMs / stats.reviews) : 0,
    }));

    // Calculate streak
    const { currentStreak, longestStreak } = calculateStreaks(dailyStatsMap, todayStart);

    const totalReviews = totalStats._count.id || 0;
    const stats: StudyStats = {
      totalReviews,
      totalCorrect: correctCount,
      overallAccuracy: totalReviews > 0 ? correctCount / totalReviews : 0,
      averageResponseMs: Math.round(totalStats._avg.responseTimeMs || 0),
      cardsStudied,
      cardsMastered,
      currentStreak,
      longestStreak,
      dailyStats,
      recentActivity: {
        today: todayReviews,
        yesterday: yesterdayReviews,
        thisWeek: weekReviews,
        thisMonth: monthReviews,
      },
    };

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error("Get user stats error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get statistics" } },
      { status: 500 }
    );
  }
}

function calculateStreaks(
  dailyStats: Map<string, { reviews: number }>,
  todayStart: Date
): { currentStreak: number; longestStreak: number } {
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  // Check last 365 days
  for (let i = 0; i < 365; i++) {
    const date = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0];
    const hasActivity = (dailyStats.get(dateStr)?.reviews || 0) > 0;

    if (i === 0 || i === 1) {
      // Allow skipping today for current streak
      if (hasActivity) {
        streak++;
      } else if (i === 1) {
        // Yesterday had no activity, streak is broken
        currentStreak = streak;
        streak = 0;
      }
    } else if (hasActivity) {
      if (streak === 0 && currentStreak > 0) {
        // Starting a historical streak after current ended
      } else {
        streak++;
      }
    } else {
      if (currentStreak === 0 && streak > 0) {
        currentStreak = streak;
      }
      longestStreak = Math.max(longestStreak, streak);
      streak = 0;
    }
  }

  if (currentStreak === 0) currentStreak = streak;
  longestStreak = Math.max(longestStreak, streak, currentStreak);

  return { currentStreak, longestStreak };
}
