/**
 * Curriculum Prerequisites API
 * GET /api/curricula/[id]/prereqs
 *
 * Returns prerequisite status for all subjects in a curriculum
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prereqService } from "@/services/prereq.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { id: curriculumId } = await params;

    const status = await prereqService.getCurriculumPrereqStatus(
      session.user.id,
      curriculumId
    );

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Get prereq status error:", error);

    if (error instanceof Error && error.message === "Curriculum not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Curriculum not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get prerequisite status" } },
      { status: 500 }
    );
  }
}
