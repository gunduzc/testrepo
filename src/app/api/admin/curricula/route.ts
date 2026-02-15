import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET: List all curricula (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const isPublic = url.searchParams.get("isPublic");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search } },
          { description: { contains: search } },
        ],
      }),
      ...(isPublic !== null && isPublic !== "" && { isPublic: isPublic === "true" }),
    };

    const [curricula, total] = await Promise.all([
      prisma.curriculum.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          isPublic: true,
          createdAt: true,
          author: {
            select: { name: true, email: true },
          },
          _count: {
            select: { curriculumSubjects: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.curriculum.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: { curricula, total } });
  } catch (error) {
    console.error("List curricula error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list curricula" } },
      { status: 500 }
    );
  }
}
