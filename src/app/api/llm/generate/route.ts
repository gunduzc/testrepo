/**
 * LLM Card Generation API
 * POST /api/llm/generate - Generate card function from description
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { llmService } from "@/services";

const generateSchema = z.object({
  description: z.string().min(10).max(1000),
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
        { error: { code: "FORBIDDEN", message: "Only educators can generate cards" } },
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
    const data = generateSchema.parse(body);

    const source = await llmService.generateCardFunction(data.description);

    return NextResponse.json({ success: true, data: { source } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    console.error("LLM generate error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to generate card" } },
      { status: 500 }
    );
  }
}
