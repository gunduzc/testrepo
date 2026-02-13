/**
 * Single Subject API
 * PUT /api/subjects/[id] - Update subject / card ordering
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { curriculumService } from "@/services";

const updateSubjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  cardIds: z.array(z.string()).optional(), // For reordering
});

export async function PUT(
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

    if (!["ADMIN", "EDUCATOR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only educators can update subjects" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateSubjectSchema.parse(body);

    const subject = await curriculumService.updateSubject(id, data, session.user.id);

    return NextResponse.json({ success: true, data: subject });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
      if (error.message.includes("Not authorized")) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: error.message } },
          { status: 403 }
        );
      }
    }

    console.error("Update subject error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update subject" } },
      { status: 500 }
    );
  }
}
