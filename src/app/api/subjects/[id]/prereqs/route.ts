/**
 * Subject Prerequisites API
 * GET /api/subjects/[id]/prereqs
 *
 * Returns prerequisite status for a specific subject
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

    const { id: subjectId } = await params;

    const status = await prereqService.checkSubjectPrereqs(
      session.user.id,
      subjectId
    );

    const accessValidation = await prereqService.validateSubjectAccess(
      session.user.id,
      subjectId
    );

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        access: accessValidation,
      },
    });
  } catch (error) {
    console.error("Get subject prereq status error:", error);

    if (error instanceof Error && error.message === "Subject not found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Subject not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get prerequisite status" } },
      { status: 500 }
    );
  }
}
