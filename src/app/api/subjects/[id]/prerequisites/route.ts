/**
 * Subject Prerequisites API
 * POST /api/subjects/[id]/prerequisites - Add prerequisite
 * DELETE /api/subjects/[id]/prerequisites - Remove prerequisite
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { curriculumService } from "@/services";

const prereqSchema = z.object({
  prerequisiteId: z.string(),
});

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

    if (!["ADMIN", "EDUCATOR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only educators can modify prerequisites" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const data = prereqSchema.parse(body);

    await curriculumService.addPrerequisite(id, data.prerequisiteId, session.user.id);

    return NextResponse.json({ success: true, message: "Prerequisite added" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
      if (error.message.includes("Not authorized")) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: error.message } },
          { status: 403 }
        );
      }
      if (error.message.includes("cycle")) {
        return NextResponse.json(
          { error: { code: "DAG_CYCLE", message: error.message } },
          { status: 400 }
        );
      }
      if (error.message.includes("already exists")) {
        return NextResponse.json(
          { error: { code: "ALREADY_EXISTS", message: error.message } },
          { status: 400 }
        );
      }
    }

    console.error("Add prerequisite error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to add prerequisite" } },
      { status: 500 }
    );
  }
}

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

    if (!["ADMIN", "EDUCATOR"].includes(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only educators can modify prerequisites" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const url = new URL(request.url);
    const prerequisiteId = url.searchParams.get("prerequisiteId");

    if (!prerequisiteId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "prerequisiteId is required" } },
        { status: 400 }
      );
    }

    await curriculumService.removePrerequisite(id, prerequisiteId, session.user.id);

    return NextResponse.json({ success: true, message: "Prerequisite removed" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: error.message } },
          { status: 404 }
        );
      }
      if (error.message.includes("Not authorized")) {
        return NextResponse.json(
          { error: { code: "FORBIDDEN", message: error.message } },
          { status: 403 }
        );
      }
    }

    console.error("Remove prerequisite error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to remove prerequisite" } },
      { status: 500 }
    );
  }
}
