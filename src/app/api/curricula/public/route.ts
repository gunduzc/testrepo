/**
 * Public Curricula API
 * GET /api/curricula/public - List public curricula
 */

import { NextRequest, NextResponse } from "next/server";
import { curriculumService } from "@/services";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const search = url.searchParams.get("search") || undefined;

    const result = await curriculumService.listPublicCurricula({ limit, offset, search });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("List public curricula error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list curricula" } },
      { status: 500 }
    );
  }
}
