/**
 * Submit Answer API
 * POST /api/study/submit
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { studyService } from "@/services";

const submitSchema = z.object({
  sessionId: z.string(),
  answer: z.string(),
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

    const body = await request.json();
    const data = submitSchema.parse(body);

    const result = await studyService.submitAnswer(
      data.sessionId,
      data.answer,
      session.user.id
    );

    if (!result) {
      return NextResponse.json(
        { error: { code: "SESSION_NOT_FOUND", message: "Study session not found or expired" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    console.error("Submit error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to submit answer" } },
      { status: 500 }
    );
  }
}
