import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { curriculumService } from "@/services/curriculum.service";

// POST: Add card to subject
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: subjectId } = await params;
    const { cardId, position } = await request.json();

    if (!cardId) {
      return NextResponse.json({ success: false, error: "cardId is required" }, { status: 400 });
    }

    await curriculumService.addCardToSubject(subjectId, cardId, session.user.id, position);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add card to subject";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
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
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: subjectId } = await params;
    const { cardId } = await request.json();

    if (!cardId) {
      return NextResponse.json({ success: false, error: "cardId is required" }, { status: 400 });
    }

    await curriculumService.removeCardFromSubject(subjectId, cardId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove card from subject";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
