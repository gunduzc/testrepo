/**
 * Export API
 * GET /api/export?type=card&id=xxx
 * GET /api/export?type=subject&id=xxx
 * GET /api/export?type=curriculum&id=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importExportService } from "@/services";

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
    const type = url.searchParams.get("type");
    const id = url.searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "type and id are required" } },
        { status: 400 }
      );
    }

    let data;

    switch (type) {
      case "card":
        data = await importExportService.exportCard(id);
        break;
      case "subject":
        data = await importExportService.exportSubject(id);
        break;
      case "curriculum":
        data = await importExportService.exportCurriculum(id);
        break;
      default:
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid type. Use card, subject, or curriculum" } },
          { status: 400 }
        );
    }

    if (!data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `${type} not found` } },
        { status: 404 }
      );
    }

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${type}-${id}.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to export" } },
      { status: 500 }
    );
  }
}
