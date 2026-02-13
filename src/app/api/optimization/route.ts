/**
 * FSRS Optimization API
 * POST /api/optimization/run - Trigger optimization (ADMIN only)
 * GET /api/optimization/status - Get optimization status
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { optimizationService } from "@/services";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only admins can run optimization" } },
        { status: 403 }
      );
    }

    const params = await optimizationService.optimizeGlobal();

    return NextResponse.json({
      success: true,
      data: { parameters: params },
      message: "Optimization completed",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Not enough reviews")) {
        return NextResponse.json(
          { error: { code: "INSUFFICIENT_DATA", message: error.message } },
          { status: 400 }
        );
      }
      if (error.message.includes("already in progress")) {
        return NextResponse.json(
          { error: { code: "ALREADY_RUNNING", message: error.message } },
          { status: 409 }
        );
      }
    }

    console.error("Optimization error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Optimization failed" } },
      { status: 500 }
    );
  }
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

    const status = await optimizationService.getOptimizationStatus();

    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error("Get optimization status error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get status" } },
      { status: 500 }
    );
  }
}
