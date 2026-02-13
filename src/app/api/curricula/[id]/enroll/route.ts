/**
 * Curriculum Enrollment API
 * POST /api/curricula/[id]/enroll - Enroll in public curriculum
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { curriculumService } from "@/services";

export async function POST(
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

    const { id } = await params;
    await curriculumService.enrollUser(id, session.user.id);

    return NextResponse.json({ success: true, message: "Enrolled successfully" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Curriculum not found") {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
      if (error.message.includes("Cannot enroll")) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: error.message } },
          { status: 403 }
        );
      }
    }

    console.error("Enroll error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to enroll" } },
      { status: 500 }
    );
  }
}
