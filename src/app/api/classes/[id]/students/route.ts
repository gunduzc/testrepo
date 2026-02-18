import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const addStudentSchema = z.object({
  email: z.string().email(),
});

const removeStudentSchema = z.object({
  userId: z.string().min(1),
});

// POST: Add student to class
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
    const parsed = addStudentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Valid email is required" } },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

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

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User not found with that email" } },
        { status: 404 }
      );
    }

    // Check if already enrolled
    const existing = await prisma.classEnrollment.findUnique({
      where: { userId_classId: { userId: user.id, classId: id } },
    });

    if (existing) {
      return NextResponse.json(
        { error: { code: "ALREADY_EXISTS", message: "Student already enrolled" } },
        { status: 409 }
      );
    }

    // Add enrollment
    await prisma.classEnrollment.create({
      data: { userId: user.id, classId: id },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    console.error("Add student error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to add student" } },
      { status: 500 }
    );
  }
}

// DELETE: Remove student from class
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
    const parsed = removeStudentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "userId is required" } },
        { status: 400 }
      );
    }

    const { userId } = parsed.data;

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

    // Check if enrollment exists
    const enrollment = await prisma.classEnrollment.findUnique({
      where: { userId_classId: { userId, classId: id } },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Student not enrolled in this class" } },
        { status: 404 }
      );
    }

    await prisma.classEnrollment.delete({
      where: { userId_classId: { userId, classId: id } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove student error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to remove student" } },
      { status: 500 }
    );
  }
}
