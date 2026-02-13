/**
 * Import API
 * POST /api/import - Import card, subject, or curriculum
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { importExportService } from "@/services";

const importCardSchema = z.object({
  type: z.literal("card"),
  data: z.any(),
  subjectId: z.string(),
  position: z.number().int().min(0),
});

const importSubjectSchema = z.object({
  type: z.literal("subject"),
  data: z.any(),
  curriculumId: z.string(),
});

const importCurriculumSchema = z.object({
  type: z.literal("curriculum"),
  data: z.any(),
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
        { error: { code: "FORBIDDEN", message: "Only educators can import content" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const type = body.type;

    let result;

    switch (type) {
      case "card": {
        const parsed = importCardSchema.parse(body);
        result = await importExportService.importCard(
          parsed.data,
          parsed.subjectId,
          parsed.position,
          session.user.id
        );
        break;
      }
      case "subject": {
        const parsed = importSubjectSchema.parse(body);
        result = await importExportService.importSubject(
          parsed.data,
          parsed.curriculumId,
          session.user.id
        );
        break;
      }
      case "curriculum": {
        const parsed = importCurriculumSchema.parse(body);
        result = await importExportService.importCurriculum(parsed.data, session.user.id);
        break;
      }
      default:
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid type. Use card, subject, or curriculum" } },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "IMPORT_FAILED", message: "Import validation failed", details: result.errors } },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    console.error("Import error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to import" } },
      { status: 500 }
    );
  }
}
