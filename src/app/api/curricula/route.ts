/**
 * Curricula API
 * POST /api/curricula - Create curriculum
 * GET /api/curricula - List curricula by author
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { curriculumService } from "@/services";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

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
        { error: { code: "FORBIDDEN", message: "Only educators can create curricula" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = createSchema.parse(body);

    const curriculum = await curriculumService.createCurriculum(data, session.user.id);

    return NextResponse.json({ success: true, data: curriculum }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    console.error("Create curriculum error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create curriculum" } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const result = await curriculumService.listByAuthor(session.user.id, { limit, offset });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("List curricula error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list curricula" } },
      { status: 500 }
    );
  }
}
