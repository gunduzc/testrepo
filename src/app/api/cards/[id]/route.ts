/**
 * Single Card API
 * GET /api/cards/[id] - Get card
 * PUT /api/cards/[id] - Update card
 * DELETE /api/cards/[id] - Delete card
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { cardService } from "@/services";
import { AnswerType } from "@/lib/types";

const updateCardSchema = z.object({
  functionSource: z.string().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  answerType: z.enum(["INTEGER", "DECIMAL", "TEXT", "FRACTION", "CHOICE"]).optional(),
  learningSteps: z.number().int().min(1).max(20).optional(),
  relearningSteps: z.number().int().min(1).max(10).optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(
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

    const { id } = await params;
    const card = await cardService.getById(id);

    if (!card) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Card not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: card });
  } catch (error) {
    console.error("Get card error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to get card" } },
      { status: 500 }
    );
  }
}

export async function PUT(
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
        { error: { code: "FORBIDDEN", message: "Only educators can update cards" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateCardSchema.parse(body);

    const card = await cardService.update(
      id,
      {
        ...data,
        answerType: data.answerType as AnswerType | undefined,
      },
      session.user.id
    );

    return NextResponse.json({ success: true, data: card });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues } },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === "Card not found") {
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
      if (error.message.includes("Invalid card function")) {
        return NextResponse.json(
          { error: { code: "INVALID_CARD", message: error.message } },
          { status: 400 }
        );
      }
    }

    console.error("Update card error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update card" } },
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
        { error: { code: "FORBIDDEN", message: "Only educators can delete cards" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    await cardService.delete(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Card not found") {
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

    console.error("Delete card error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete card" } },
      { status: 500 }
    );
  }
}
