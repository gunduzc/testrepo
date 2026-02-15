/**
 * Browsable Curricula API
 * GET /api/curricula/public - List browsable curricula
 * Access depends on instance mode:
 * - community/publisher: all curricula
 * - school: only assigned curricula for students
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { curriculumService } from "@/services";

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
    const search = url.searchParams.get("search") || undefined;

    const result = await curriculumService.listBrowsableCurricula(
      session.user.id,
      session.user.role,
      { limit, offset, search }
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("List browsable curricula error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list curricula" } },
      { status: 500 }
    );
  }
}
