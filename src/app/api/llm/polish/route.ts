/**
 * LLM Card Polish API
 * POST /api/llm/polish - Revise card function based on feedback
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { llmService } from "@/services";

const polishSchema = z.object({
  source: z.string().min(1),
  feedback: z.string().min(1),
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
        { error: { code: "FORBIDDEN", message: "Only educators can polish cards" } },
        { status: 403 }
      );
    }

    if (!llmService.isAvailable()) {
      return NextResponse.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "LLM service not configured" } },
        { status: 503 }
      );
    }

    const body = await request.json();
    const data = polishSchema.parse(body);

    const revisedSource = await llmService.polishCardFunction(
      data.source,
      data.feedback
    );

    return NextResponse.json({ success: true, data: { source: revisedSource } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    console.error("LLM polish error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to polish card" } },
      { status: 500 }
    );
  }
}
