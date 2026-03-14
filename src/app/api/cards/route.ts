/**
 * Cards API
 * POST /api/cards - Create card
 * GET /api/cards - List cards by author
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { cardService } from "@/services";
import { AnswerType } from "@/lib/types";
import { canCreateContent } from "@/lib/instance-config";

const createCardSchema = z.object({
  functionSource: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().min(1),
  answerType: z.enum(["INTEGER", "DECIMAL", "TEXT", "FRACTION", "CHOICE"]),
  learningSteps: z.number().int().min(1).max(20).optional(),
  relearningSteps: z.number().int().min(1).max(10).optional(),
  reviewSteps: z.number().int().min(1).max(10).optional(),
  tags: z.array(z.string()).optional(),
  subjectId: z.string().optional(),
  position: z.number().int().min(0).optional(),
  authoringHistory: z.array(z.object({
    type: z.enum(["prompt", "generation", "flag", "correction", "approval"]),
    content: z.string(),
    timestamp: z.string(),
    sampleIndex: z.number().optional(),
  })).optional(),
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

    // Check if user can create content based on instance mode
    if (!canCreateContent(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You don't have permission to create cards" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = createCardSchema.parse(body);

    const card = await cardService.create(
      {
        ...data,
        answerType: data.answerType as AnswerType,
      },
      session.user.id
    );

    return NextResponse.json({ success: true, data: card }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes("Invalid card function")) {
      return NextResponse.json(
        { error: { code: "INVALID_CARD", message: error.message } },
        { status: 400 }
      );
    }

    console.error("Create card error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create card" } },
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
    const search = url.searchParams.get("search");

    if (search) {
      const result = await cardService.search(search, { limit, offset });
      return NextResponse.json({ success: true, data: result });
    }

    const result = await cardService.getByAuthor(session.user.id, { limit, offset });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("List cards error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to list cards" } },
      { status: 500 }
    );
  }
}
