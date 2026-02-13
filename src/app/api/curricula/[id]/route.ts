/**
 * Single Curriculum API
 * GET /api/curricula/[id] - Get curriculum with structure
 * PUT /api/curricula/[id] - Update curriculum
 * DELETE /api/curricula/[id] - Delete curriculum
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { curriculumService } from "@/services";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

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

    const { id } = await params;
    const curriculum = await curriculumService.getCurriculumWithStructure(id);

    if (!curriculum) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Curriculum not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: curriculum });
  } catch (error) {
    console.error("Get curriculum error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get curriculum" } },
      { status: 500 }
    );
  }
}

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
        { error: { code: "FORBIDDEN", message: "Only educators can update curricula" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    const curriculum = await curriculumService.updateCurriculum(id, data, session.user.id);

    return NextResponse.json({ success: true, data: curriculum });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === "Curriculum not found") {
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

    console.error("Update curriculum error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update curriculum" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
        { error: { code: "FORBIDDEN", message: "Only educators can delete curricula" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    await curriculumService.deleteCurriculum(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Curriculum not found") {
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

    console.error("Delete curriculum error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete curriculum" } },
      { status: 500 }
    );
  }
}
