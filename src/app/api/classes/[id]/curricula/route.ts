import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const curriculumSchema = z.object({
  curriculumId: z.string().min(1),
});

// POST: Assign curriculum to class
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
    const body = await request.json();
    const parsed = curriculumSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "curriculumId is required" } },
        { status: 400 }
      );
    }

    const { curriculumId } = parsed.data;

    const classData = await prisma.class.findUnique({ where: { id } });

    if (!classData) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Class not found" } },
        { status: 404 }
      );
    }

    if (classData.educatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Verify curriculum exists
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      select: { id: true, name: true, description: true },
    });

    if (!curriculum) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Curriculum not found" } },
        { status: 404 }
      );
    }

    // Check if already assigned
    const existing = await prisma.curriculumAssignment.findUnique({
      where: { classId_curriculumId: { classId: id, curriculumId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: { code: "ALREADY_EXISTS", message: "Curriculum already assigned" } },
        { status: 409 }
      );
    }

    // Add assignment
    await prisma.curriculumAssignment.create({
      data: { classId: id, curriculumId },
    });

    return NextResponse.json({ success: true, data: curriculum }, { status: 201 });
  } catch (error) {
    console.error("Assign curriculum error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to assign curriculum" } },
      { status: 500 }
    );
  }
}

// DELETE: Remove curriculum from class
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

    const { id } = await params;
    const body = await request.json();
    const parsed = curriculumSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "curriculumId is required" } },
        { status: 400 }
      );
    }

    const { curriculumId } = parsed.data;

    const classData = await prisma.class.findUnique({ where: { id } });

    if (!classData) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Class not found" } },
        { status: 404 }
      );
    }

    if (classData.educatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    // Check if assignment exists
    const assignment = await prisma.curriculumAssignment.findUnique({
      where: { classId_curriculumId: { classId: id, curriculumId } },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Curriculum not assigned to this class" } },
        { status: 404 }
      );
    }

    await prisma.curriculumAssignment.delete({
      where: { classId_curriculumId: { classId: id, curriculumId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove curriculum error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to remove curriculum" } },
      { status: 500 }
    );
  }
}
