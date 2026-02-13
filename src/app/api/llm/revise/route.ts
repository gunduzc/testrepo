/**
 * LLM Card Revision API
 * POST /api/llm/revise - Revise card function based on flagged samples
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { llmService } from "@/services";

const flaggedSampleSchema = z.object({
  sampleIndex: z.number(),
  generatedQuestion: z.string(),
  generatedAnswer: z.string(),
  correctedAnswer: z.string().optional(),
  comment: z.string().optional(),
});

const reviseSchema = z.object({
  source: z.string(),
  flaggedSamples: z.array(flaggedSampleSchema).min(1),
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
        { error: { code: "FORBIDDEN", message: "Only educators can revise cards" } },
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
    const data = reviseSchema.parse(body);

    const revisedSource = await llmService.reviseCardFunction(
      data.source,
      data.flaggedSamples
    );

    return NextResponse.json({ success: true, data: { source: revisedSource } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    console.error("LLM revise error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to revise card" } },
      { status: 500 }
    );
  }
}
