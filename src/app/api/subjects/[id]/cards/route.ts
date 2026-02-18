import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { curriculumService } from "@/services/curriculum.service";

const addCardSchema = z.object({
  cardId: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

const removeCardSchema = z.object({
  cardId: z.string().min(1),
});

// POST: Add card to subject
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id: subjectId } = await params;
    const body = await request.json();
    const parsed = addCardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.issues } },
        { status: 400 }
      );
    }

    await curriculumService.addCardToSubject(
      subjectId,
      parsed.data.cardId,
      session.user.id,
      parsed.data.position
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add card to subject";
    return NextResponse.json(
      { error: { code: "OPERATION_FAILED", message } },
      { status: 400 }
    );
  }
}

// DELETE: Remove card from subject
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id: subjectId } = await params;
    const body = await request.json();
    const parsed = removeCardSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.issues } },
        { status: 400 }
      );
    }

    await curriculumService.removeCardFromSubject(subjectId, parsed.data.cardId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove card from subject";
    return NextResponse.json(
      { error: { code: "OPERATION_FAILED", message } },
      { status: 400 }
    );
  }
}
