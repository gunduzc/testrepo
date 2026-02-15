import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET: Get class details
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

    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        curriculumAssignments: {
          include: {
            curriculum: {
              select: { id: true, name: true, description: true },
            },
          },
        },
      },
    });

    if (!classData) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Class not found" } },
        { status: 404 }
      );
    }

    // Only owner or admin can view
    if (classData.educatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: classData });
  } catch (error) {
    console.error("Get class error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get class" } },
      { status: 500 }
    );
  }
}

// PUT: Update class
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

    const { id } = await params;
    const { name } = await request.json();

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

    const updated = await prisma.class.update({
      where: { id },
      data: { name: name?.trim() || classData.name },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update class error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update class" } },
      { status: 500 }
    );
  }
}

// DELETE: Delete class
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

    await prisma.class.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete class error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete class" } },
      { status: 500 }
    );
  }
}
