/**
 * Study API
 * GET /api/study/[curriculumId] - Get next question
 * GET /api/study/[curriculumId]/progress - Get progress (handled in next.ts)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { studyService } from "@/services";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ curriculumId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { curriculumId } = await params;

    // Check if requesting progress
    const url = new URL(request.url);
    if (url.pathname.endsWith("/progress")) {
      const progress = await studyService.getProgress(session.user.id, curriculumId);
      return NextResponse.json({ success: true, data: progress });
    }

    // Get next question
    const question = await studyService.getNextQuestion(session.user.id, curriculumId);

    if (!question) {
      // No cards due
      const nextDue = await studyService.getNextDueTime(session.user.id, curriculumId);
      return NextResponse.json({
        success: true,
        data: null,
        message: "No cards due",
        nextDue,
      });
    }

    return NextResponse.json({ success: true, data: question });
  } catch (error) {
    console.error("Study error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get question" } },
      { status: 500 }
    );
  }
}
