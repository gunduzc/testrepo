import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET: List educator's classes
export async function GET() {
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
        { error: { code: "FORBIDDEN", message: "Educator access required" } },
        { status: 403 }
      );
    }

    const classes = await prisma.class.findMany({
      where: { educatorId: session.user.id },
      include: {
        _count: {
          select: {
            enrollments: true,
            curriculumAssignments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: classes });
  } catch (error) {
    console.error("List classes error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list classes" } },
      { status: 500 }
    );
  }
}

// POST: Create a new class
export async function POST(request: NextRequest) {
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
        { error: { code: "FORBIDDEN", message: "Educator access required" } },
        { status: 403 }
      );
    }

    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Class name is required" } },
        { status: 400 }
      );
    }

    const newClass = await prisma.class.create({
      data: {
        name: name.trim(),
        educatorId: session.user.id,
      },
    });

    return NextResponse.json({ success: true, data: newClass }, { status: 201 });
  } catch (error) {
    console.error("Create class error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create class" } },
      { status: 500 }
    );
  }
}
