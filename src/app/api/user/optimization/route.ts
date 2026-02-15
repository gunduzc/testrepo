/**
 * User FSRS Optimization API
 * GET /api/user/optimization - Get user's optimization status and parameters
 * POST /api/user/optimization - Run optimization for current user
 * DELETE /api/user/optimization - Reset to global parameters
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { optimizationService } from "@/services";
import { DEFAULT_FSRS_PARAMETERS } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fsrsParameters: true },
    });

    // Get user's review count
    const reviewCount = await prisma.reviewLog.count({
      where: { userId: session.user.id },
    });

    // Get recent accuracy stats
    const recentReviews = await prisma.reviewLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { correct: true },
    });

    const recentAccuracy =
      recentReviews.length > 0
        ? recentReviews.filter((r) => r.correct).length / recentReviews.length
        : null;

    const hasCustomParameters = !!user?.fsrsParameters;
    const currentParameters = user?.fsrsParameters
      ? JSON.parse(user.fsrsParameters)
      : DEFAULT_FSRS_PARAMETERS;

    return NextResponse.json({
      success: true,
      data: {
        hasCustomParameters,
        currentParameters,
        reviewCount,
        recentAccuracy,
        canOptimize: reviewCount >= 100,
        minimumReviewsNeeded: 100,
      },
    });
  } catch (error) {
    console.error("Get user optimization error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get optimization status" } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const params = await optimizationService.optimizeForStudent(session.user.id);

    return NextResponse.json({
      success: true,
      data: { parameters: params },
      message: "Your FSRS parameters have been optimized based on your study history",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Not enough reviews")) {
        return NextResponse.json(
          { error: { code: "INSUFFICIENT_DATA", message: error.message } },
          { status: 400 }
        );
      }
    }

    console.error("User optimization error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Optimization failed" } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    await optimizationService.resetStudentParameters(session.user.id);

    return NextResponse.json({
      success: true,
      message: "FSRS parameters reset to global defaults",
    });
  } catch (error) {
    console.error("Reset parameters error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to reset parameters" } },
      { status: 500 }
    );
  }
}
