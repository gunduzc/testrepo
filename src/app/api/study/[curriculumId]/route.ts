/**
 * Study API
 * GET /api/study/[curriculumId] - Get next question
 * GET /api/study/[curriculumId]?preview=true - Get preview question (educators only)
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
    const url = new URL(request.url);
    const isPreview = url.searchParams.get("preview") === "true";

    // Check if requesting progress
    if (url.pathname.endsWith("/progress")) {
      const progress = await studyService.getProgress(session.user.id, curriculumId);
      return NextResponse.json({ success: true, data: progress });
    }

    // Preview mode for educators
    if (isPreview) {
      if (!["ADMIN", "EDUCATOR"].includes(session.user.role)) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: "Preview mode is for educators only" } },
          { status: 403 }
        );
      }

      const question = await studyService.getPreviewQuestion(curriculumId);
      if (!question) {
        return NextResponse.json({
          success: true,
          data: null,
          message: "No cards in curriculum",
        });
      }
      return NextResponse.json({ success: true, data: question });
    }

    // Regular study mode - get next due question
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
